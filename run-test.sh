#!/usr/bin/bash

if [ "$1" == "" -o "$2" == "" ]; then
	echo 'USAGE: run-test.sh TOOLCHAIN RUSTC_TARGET'
	exit 1
fi

set -xe

pushd litmus
rm -rf target

cargo +$1 build --target=$2 -Zbuild-std
