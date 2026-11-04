//! Network routing for Minecraft resources in the standalone launcher.
//!
//! The previous fork proxied Modrinth, CurseForge, Mojang and Java downloads
//! through a Millida server. Minimal Launcher never uses that proxy: resources
//! are fetched from their official sources only.

/// Marker retained for callers that classify a direct network failure.
pub(crate) const NO_LINK: &str = "нет связи";

/// There is no fallback proxy in the standalone build.
pub(crate) fn proxy_url(_url: &str) -> Option<String> {
    None
}

/// A network failure must not trigger a hidden third-party fallback.
pub(crate) fn abandon_direct(_route: &str, _err: &str) -> bool {
    false
}

/// Minecraft manifests, libraries, Java and mod files are requested directly.
pub(crate) async fn routes(url: &str) -> Vec<String> {
    vec![url.to_string()]
}

/// Kept as a separate entry point for install code; standalone has one route.
pub(crate) async fn routes_round_trip(url: &str) -> Vec<String> {
    vec![url.to_string()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn there_is_no_upstream_proxy_or_fallback() {
        for url in [
            "https://api.modrinth.com/v2/project/sodium",
            "https://cdn.modrinth.com/data/file.jar",
            "https://launchermeta.mojang.com/manifest.json",
            "https://api.adoptium.net/v3/info/available_releases",
            "https://maven.fabricmc.net/net/fabricmc/fabric-loader/loader.jar",
        ] {
            assert_eq!(proxy_url(url), None);
        }
        assert!(!abandon_direct("https://api.modrinth.com/v2/project/sodium", NO_LINK));
    }
}
