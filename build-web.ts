import * as toml from 'https://deno.land/std@0.113.0/encoding/toml.ts';
import * as path from 'https://deno.land/std@0.113.0/path/mod.ts';
import * as log from 'https://deno.land/std@0.113.0/log/mod.ts';
import { promisify } from 'https://deno.land/std@0.113.0/node/util.ts';
import nunjucks from "https://deno.land/x/nunjucks@3.2.3/mod.js";

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
for (const assetName of ['solid-rs.png', 'solid-rs.webp']) {
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
