use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashMap, fs, path::Path};
#[derive(Default, Serialize, Deserialize, Clone)]
pub struct Vault {
    pub cookies: HashMap<String, String>,
    pub context: Option<Value>,
    pub grant: Option<Value>,
}
#[cfg(windows)]
fn crypt(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut out = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    // DPAPI binds secrets to the current Windows user. Never allow a credentials prompt.
    let ok = unsafe {
        if encrypt {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out,
            )
        } else {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out,
            )
        }
    };
    if ok == 0 {
        return Err("Windows could not unlock the saved session. Sign in again.".into());
    }
    let value = unsafe { std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec() };
    unsafe {
        LocalFree(out.pbData as _);
    };
    Ok(value)
}
#[cfg(not(windows))]
fn crypt(_bytes: &[u8], _encrypt: bool) -> Result<Vec<u8>, String> {
    Err("Secure session storage is configured for Windows only.".into())
}
pub fn load(path: &Path) -> Vault {
    fs::read(path)
        .ok()
        .and_then(|v| crypt(&v, false).ok())
        .and_then(|v| serde_json::from_slice(&v).ok())
        .unwrap_or_default()
}
pub fn save(path: &Path, value: &Vault) -> Result<(), String> {
    let bytes = serde_json::to_vec(value).map_err(|_| "Session storage failed")?;
    let encrypted = crypt(&bytes, true)?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, encrypted).map_err(|_| "Session storage failed")?;
    fs::rename(temporary, path).map_err(|_| "Session storage failed".into())
}
