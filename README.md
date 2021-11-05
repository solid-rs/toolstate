# solid-rs-toolstate

This tool automatically tracks the build status of the Rust toolchain on [the `*-kmc-solid_*` targets][1].

## `update-data.ts`

This [Deno][2] script attempts to build the `:/litmus` test project and records the result in `:/data/timeline.toml`.

**Warning: This script will uninstall the toolchain after checking its build status!**

[1]: https://doc.rust-lang.org/nightly/rustc/platform-support/kmc-solid.html
[2]: https://deno.land/
