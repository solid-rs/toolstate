import { toml, path, log, promisify, _nunjucks as nunjucks, ensureDir } from './deps.ts';
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
const webDirPath = path.join(repositoryPath, 'web');
const buildDirPath = path.join(repositoryPath, 'build');
await ensureDir(buildDirPath);

// Read the existing timeline
const timelinePath = path.join(dataDirPath, 'timeline.toml');
const timelineToml = await Deno.readTextFile(timelinePath);
const timeline: Timeline = toml.parse(timelineToml) as any;

timeline.toolchains.sort((x, y) => {
    const xd = getDateOfNightlyToolchain(x.name);
    const yd = getDateOfNightlyToolchain(y.name);
    return (yd || 0) - (xd || 0);
});

// Copy assets
for (const assetName of ['solid-rs.svg']) {
    logger.info(`Copying '${assetName}'`);
    await Deno.copyFile(
        path.join(webDirPath, assetName),
        path.join(buildDirPath, assetName));
}

logger.info(`Rendering 'index.html'`);
const templateContext = {
    targets: TARGETS,
    timeline, 
};
const index = await promisify(nunjucks.render)(
    path.join(webDirPath, 'index.html'), templateContext);
await Deno.writeTextFile(path.join(buildDirPath, 'index.html'), index);

// JSON API
logger.info(`Rendering 'api/v0/toolchains.json'`);
const apiV0Toolchains = timeline.toolchains.map(toolchain => {
    const ok = toolchain.type === 'ok' && toolchain.targets.every(t => t.type === 'ok');
    const rustc_version = toolchain.type === 'ok' ? toolchain.rustc_version : null;
    return {
        name: toolchain.name,
        rustc_version,
        status: {
            "std": ok,
        },
    };
});
await ensureDir(path.join(buildDirPath, 'api/v0'));
await Deno.writeTextFile(path.join(buildDirPath, 'api/v0/toolchains.json'),
    JSON.stringify(apiV0Toolchains));
