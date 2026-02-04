# Security Assumptions

## Untrusted Server

The signaling server is **not trusted** with:

- Voice media
- Encryption keys
- Session secrets

Design assumes the server may be compromised or operated by an adversary. Call confidentiality is preserved regardless.

## Trusted Clients

Client devices are assumed to:

- Run unmodified application code
- Protect keys in memory during the call
- Not leak session material to third parties

## Network

- The Internet is treated as hostile
- Attackers may intercept, modify, or drop packets
- Security does not rely on network infrastructure
