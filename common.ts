
export const TARGETS = [
	'aarch64-kmc-solid_asp3',
	'armv7a-kmc-solid_asp3-eabi',
	'armv7a-kmc-solid_asp3-eabihf',
];

export interface Timeline {
	toolchains: ToolchainState[],
}

export type ToolchainState = 
	{ name: string } 
	& (
		| { type: 'missing' } // rustup doesn't provide this one
		| { type: 'error' }   // something went wrong
		| { type: 'pending' } // for some reason, the data is missing and pending for update.
							  // set this manually to recheck the state.
		| {
			type: 'ok',
			rustc_version: string,
			targets: TargetState[],
		});

export interface TargetState {
	name: string,
	type: 'ok' | 'error',
}

export function getDateOfNightlyToolchain(name: string): number | null {
	const match = /nightly-([0-9]+)-([0-9]+)-([0-9]+)/.exec(name);
	if (match) {
		return Date.UTC(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
	} else {
		return null;
	}
}

export function getLatestNightlyDateOfTimeline(timeline: Timeline): number {
	return timeline.toolchains.reduce(
		(acc, { name }) => {
			const thisNightly = getDateOfNightlyToolchain(name);
			if (thisNightly != null) {
				return Math.max(acc, thisNightly);
			} else {
				return acc;
			}
		},
		Date.UTC(2021, 10, 4)	
	);
}

export function getToday(): number {
	const now = new Date();
	return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}
