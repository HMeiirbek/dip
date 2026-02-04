# Threat Model

## Key Security Properties

| Property | Description |
|----------|-------------|
| **End-to-End Encryption** | Voice data is encrypted on the sender's device and decrypted only on the receiver's device |
| **No Trusted Server** | The signaling server is considered untrusted and has no access to media or keys |
| **Ephemeral Session Keys** | New encryption keys are generated for every call session |
| **Interception Resistance** | Captured network traffic does not allow reconstruction of audio data |

## Trust Boundaries

| Zone | Contents |
|------|----------|
| **Trusted Zone** | Client devices participating in the call |
| **Untrusted Zone** | Signaling server, network infrastructure, and the Internet |

**Implication:** Even if the signaling server is compromised, the confidentiality of voice communication remains preserved.
