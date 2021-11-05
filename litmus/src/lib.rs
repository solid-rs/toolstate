#[no_mangle]
pub extern "C" fn hello(f: extern "C" fn() -> usize) -> usize {
    std::thread::spawn(move || f()).join().unwrap()
}
