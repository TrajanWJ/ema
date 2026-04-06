/// Validates the Origin header from a WebSocket upgrade request.
/// Returns true if the origin is in the allowlist.
///
/// Allowlist:
///   - https://place.org
///   - https://www.place.org
///   - http://localhost:3000 through http://localhost:3009
pub fn is_allowed_origin(origin: &str) -> bool {
    let origin = origin.trim();

    if origin == "https://place.org" || origin == "https://www.place.org" {
        return true;
    }

    // http://localhost:PORT where PORT is 3000..=3009
    if let Some(rest) = origin.strip_prefix("http://localhost:") {
        if let Ok(port) = rest.parse::<u16>() {
            return (3000..=3009).contains(&port);
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_place_org() {
        assert!(is_allowed_origin("https://place.org"));
        assert!(is_allowed_origin("https://www.place.org"));
    }

    #[test]
    fn allows_localhost_dev_ports() {
        assert!(is_allowed_origin("http://localhost:3000"));
        assert!(is_allowed_origin("http://localhost:3009"));
    }

    #[test]
    fn rejects_other_localhost_ports() {
        assert!(!is_allowed_origin("http://localhost:8080"));
        assert!(!is_allowed_origin("http://localhost:4000"));
    }

    #[test]
    fn rejects_subdomains() {
        assert!(!is_allowed_origin("https://evil.place.org"));
        assert!(!is_allowed_origin("https://sub.place.org"));
    }

    #[test]
    fn rejects_arbitrary_origins() {
        assert!(!is_allowed_origin("https://evil.com"));
        assert!(!is_allowed_origin("file:///etc/passwd"));
        assert!(!is_allowed_origin(""));
    }
}
