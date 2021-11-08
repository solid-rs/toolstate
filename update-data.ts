import * as flags from 'https://deno.land/std@0.113.0/flags/mod.ts';
import * as toml from 'https://deno.land/std@0.113.0/encoding/toml.ts';
import * as path from 'https://deno.land/std@0.113.0/path/mod.ts';
import * as log from 'https://deno.land/std@0.113.0/log/mod.ts';
import { ensureDir } from 'https://deno.land/std@0.113.0/fs/ensure_dir.ts';
import { exists } from 'https://deno.land/std@0.113.0/fs/exists.ts';

import { TARGETS, Timeline, ToolchainState, TargetState,
	getLatestNightlyDateOfTimeline } from "./common.ts";

const parsedArgs = flags.parse(Deno.args, {
	'alias': {
		h: 'help',
	},
});

if (parsedArgs['help']) {
	console.log("This tool updates data files in `:/data`.");
	Deno.exit(1);
}

await log.setup({
    handlers: {
        console: new log.handlers.ConsoleHandler("DEBUG"),
    },

    loggers: {
        default: {
            level: "INFO",
            handlers: ["console"],
        },
    },
});
const logger = log.getLogger();

// Directories
const repositoryPath = '.';
const dataDirPath = path.join(repositoryPath, 'data');
await ensureDir(dataDirPath);

// Read the existing timeline
const timelinePath = path.join(dataDirPath, 'timeline.toml');
let timeline: Timeline = {
	toolchains: [],
};

if (await exists(timelinePath)) {
	const timelineToml = await Deno.readTextFile(timelinePath);
	timeline = toml.parse(timelineToml) as any;
}

// Prerequisites
logger.info(`Checking the existence of 'rustup'`);
{
	const p = Deno.run({cmd: ['rustup', '--version']});
	await p.status();
	p.close();
}

// Update the timeline
async function checkToolchain(toolchain: string) {
	const existingI = timeline.toolchains.findIndex(({ name }) => name === toolchain);
	if (existingI >= 0) {
		if (timeline.toolchains[existingI].type !== 'pending') {
			// already known
			return;
		} 

		// remove the existing "pending" one
		timeline.toolchains.splice(existingI, 1);
	}

	logger.info(`Checking the state of '${toolchain}'`);

	let st: ToolchainState = { name: toolchain, type: 'error' };
	try {
		st = await checkToolchainInner(toolchain);
	} catch (e) {
		logger.warning(String(e));
	}

	// Register the result
	timeline.toolchains.push(st);
}


async function checkToolchainInner(toolchain: string): Promise<ToolchainState> {
	// Install the toolchain
	{
		const p = Deno.run({
			cmd: ['rustup', 'toolchain', 'install', toolchain, '--profile', 'minimal'],
		});
		const status = await p.status();
		p.close();
		if (!status.success) {
			// TODO: detect intermittent network error
			return { name: toolchain, type: 'missing' };
		}
	}

	// Install the Rust source code (needed to `-Z build-std`)
	{
		const p = Deno.run({
			cmd: ['rustup', 'component', 'add', 'rust-src', '--toolchain', toolchain],
		});
		const status = await p.status();
		p.close();
		if (!status.success) {
			throw new Error(`'rustup component add rust-src' failed`);
		}
	}

	try {
		// Get the rustc version
		let rustcVersion: string;
		{
			const p = Deno.run({
				cmd: ['rustc', `+${toolchain}`, '--version'],
				stdout: 'piped',
			});
			const [status, stdout] = await Promise.all([p.status(), p.output()]);
			p.close();
			rustcVersion = new TextDecoder().decode(stdout).trim();
			if (!status.success) {
				throw new Error(`'rustc --version' failed`);
			}
		}
	
		logger.info(`rustcVersion = '${rustcVersion}'`);

		// Test targets
		const runTestPath = path.join(repositoryPath, 'run-test.sh');

		const targets: TargetState[] = [];
		for (const target of TARGETS) {
			logger.info(`Checking '${toolchain}' + '${target}'`);

			const p = Deno.run({
				cmd: ['bash', runTestPath, toolchain, target],
			});
			const status = await p.status();
			p.close();

			targets.push({
				name: target,
				type: status.success ? 'ok' : 'error',
			});
		}

		return { 
			name: toolchain,
			type: 'ok',
			rustc_version: rustcVersion,
			targets,
		};
	} finally {
		// Uninstall the toolchain
		try {
			const p = Deno.run({
				cmd: ['rustup', 'toolchain', 'remove', toolchain],
			});
			await p.status();
			p.close();
		} catch (e) {
			logger.warning(`Could not remove an installed toolchain: ${e}`);
		}
	}
}

function pad(x: unknown, i: number) {
	const st = String(x);
	return '0'.repeat(Math.max(0, i - st.length)) + st;
}

function formatDate(t: number) {
	const d = new Date(t);
	return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

const latestKnownNightly = getLatestNightlyDateOfTimeline(timeline);
const now = new Date();
const latestNightly = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

logger.info(`The latest nightly toolchain with a known state is ${formatDate(latestKnownNightly)}`);
logger.info(`The latest (possible) nightly toolchain is ${formatDate(latestNightly)}`);

for (let t = latestKnownNightly + 86400000; t <= latestNightly; t += 86400000) {
	await checkToolchain(`nightly-${formatDate(t)}`);
}

const pendingToolchains = timeline.toolchains.filter(({ type }) => type === 'pending');
for (const { name } of pendingToolchains) {
	logger.warning(`Toolchain '${name}' is marked as 'pending'; checking it`);
	await checkToolchain(name);
}

// Save the updated timeline
{
	const timelineToml = toml.stringify(timeline as any);
	await Deno.writeTextFile(timelinePath, timelineToml);
}
