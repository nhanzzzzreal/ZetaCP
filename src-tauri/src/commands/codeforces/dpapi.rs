// src-tauri/src/commands/codeforces/dpapi.rs

#[cfg(windows)]
#[repr(C)]
#[allow(non_snake_case)]
pub struct DATA_BLOB {
    pub cbData: u32,
    pub pbData: *mut u8,
}

#[cfg(windows)]
#[link(name = "crypt32")]
extern "system" {
    pub fn CryptProtectData(
        pDataIn: *const DATA_BLOB,
        szDataDescr: *const u16,
        pOptionalEntropy: *const DATA_BLOB,
        pvReserved: *mut std::ffi::c_void,
        pPromptStruct: *mut std::ffi::c_void,
        dwFlags: u32,
        pDataOut: *mut DATA_BLOB,
    ) -> i32;

    pub fn CryptUnprotectData(
        pDataIn: *const DATA_BLOB,
        ppszDataDescr: *mut *mut u16,
        pOptionalEntropy: *const DATA_BLOB,
        pvReserved: *mut std::ffi::c_void,
        pPromptStruct: *mut std::ffi::c_void,
        dwFlags: u32,
        pDataOut: *mut DATA_BLOB,
    ) -> i32;
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    pub fn LocalFree(hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
}

#[cfg(windows)]
pub fn encrypt(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::ptr;
    use std::ffi::c_void;

    if data.is_empty() {
        return Ok(Vec::new());
    }

    let input = DATA_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };

    let mut output = DATA_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    unsafe {
        let res = CryptProtectData(
            &input as *const DATA_BLOB,
            ptr::null(),
            ptr::null(),
            ptr::null_mut(),
            ptr::null_mut(),
            0,
            &mut output as *mut DATA_BLOB,
        );

        if res == 0 {
            return Err("CryptProtectData failed".to_string());
        }

        let mut out_vec = vec![0u8; output.cbData as usize];
        ptr::copy_nonoverlapping(output.pbData, out_vec.as_mut_ptr(), output.cbData as usize);
        LocalFree(output.pbData as *mut c_void);

        Ok(out_vec)
    }
}

#[cfg(windows)]
pub fn decrypt(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::ptr;
    use std::ffi::c_void;

    if data.is_empty() {
        return Ok(Vec::new());
    }

    let input = DATA_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };

    let mut output = DATA_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    unsafe {
        let res = CryptUnprotectData(
            &input as *const DATA_BLOB,
            ptr::null_mut(),
            ptr::null(),
            ptr::null_mut(),
            ptr::null_mut(),
            0,
            &mut output as *mut DATA_BLOB,
        );

        if res == 0 {
            return Err("CryptUnprotectData failed".to_string());
        }

        let mut out_vec = vec![0u8; output.cbData as usize];
        ptr::copy_nonoverlapping(output.pbData, out_vec.as_mut_ptr(), output.cbData as usize);
        LocalFree(output.pbData as *mut c_void);

        Ok(out_vec)
    }
}

#[cfg(not(windows))]
pub fn encrypt(_data: &[u8]) -> Result<Vec<u8>, String> {
    Err("DPAPI is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn decrypt(_data: &[u8]) -> Result<Vec<u8>, String> {
    Err("DPAPI is only supported on Windows".to_string())
}
