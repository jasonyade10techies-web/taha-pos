fn main() {
    println!("cargo:rerun-if-env-changed=TAHA_API_URL");
    if std::env::var("PROFILE").as_deref() == Ok("release") {
        let address = std::env::var("TAHA_API_URL").expect(
            "Set TAHA_API_URL to the selected production HTTPS API before building a release.",
        );
        let url =
            url::Url::parse(&address).expect("TAHA_API_URL must be a valid HTTPS API origin.");
        let private = url.host_str().is_some_and(|host| {
            host == "localhost"
                || host.ends_with(".local")
                || host.parse::<std::net::Ipv4Addr>().is_ok_and(|ip| {
                    ip.is_private() || ip.is_loopback() || ip.is_link_local() || ip.is_unspecified()
                })
        });
        assert!(
            url.scheme() == "https"
                && url.host_str().is_some()
                && !private
                && url.username().is_empty()
                && url.password().is_none()
                && url.query().is_none()
                && url.fragment().is_none()
                && matches!(url.path(), "/" | "/api/v1" | "/api/v1/"),
            "Release TAHA_API_URL must be a public HTTPS API origin without credentials."
        );
        println!("cargo:rustc-env=TAHA_API_URL={address}");
    }
    tauri_build::build()
}
