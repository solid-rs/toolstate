import * as toml from 'https://deno.land/std@0.113.0/encoding/toml.ts';
import * as path from 'https://deno.land/std@0.113.0/path/mod.ts';
import * as log from 'https://deno.land/std@0.113.0/log/mod.ts';
import { ensureDir } from 'https://deno.land/std@0.113.0/fs/ensure_dir.ts';
import { TARGETS, Timeline, getDateOfNightlyToolchain,
	getLatestNightlyDateOfTimeline  } from "./common.ts";

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

// Read the existing timeline
const timelinePath = path.join(dataDirPath, 'timeline.toml');
const timelineToml = await Deno.readTextFile(timelinePath);
const timeline: Timeline = toml.parse(timelineToml) as any;

// Fail if the latest toolchain is not okay
const latestKnownNightly = getLatestNightlyDateOfTimeline(timeline);
let okay = true;

for (const toolchain of timeline.toolchains) {
	if (getDateOfNightlyToolchain(toolchain.name) !== latestKnownNightly) {
		continue;
	}

	if (toolchain.type !== 'ok') {
		logger.error(`Toolchain '${toolchain.name}' failed`);
		okay = false;
		break;
	}

	for (const target of toolchain.targets) {
		if (target.type !== 'ok') {
			logger.error(`Toolchain '${toolchain.name}' has a failing target: '${target.name}'`);
			okay = false;
		}
	}
}

if (!okay) {
	Deno.exit(1);
}
