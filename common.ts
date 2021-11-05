
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
