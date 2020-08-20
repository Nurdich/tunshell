# Tunshell (Beta)

https://tunshell.com

Tunshell is a simple and secure method to remote shell into ephemeral environments such as deployment pipelines or serverless functions.
The project is predominately written in [Rust](https://www.rust-lang.org/).

## Why?

> Why would I use this over my well-established SSH client?

Good question, you wouldn't! 
The use case for tunshell is predominantly quick, ad-hoc remote access to hosts which you may not have SSH access to, or even the ability to install an SSH daemon at all. 
The beauty of tunshell is that its client is a statically-linked, pre-compiled binary which can be installed by downloading it with a one-liner script. 
This makes it ideal to debug environments you normally wouldn't have shell access to, some examples:

### Debugging Deployment Pipelines

Tunshell allows you to remote shell into GitHub Actions, BitBucket Pipelines etc by inserting a one-liner into your build scripts. 
If you've ever spent hours trying to track down an issue on a deployment pipeline that you couldn't replicate locally because of subtle environmental differences, this could come in handy.

### Serverless Functions

Tunshell even supports extremely limited environments such as AWS Lambda or Google Cloud Functions. 
As these platforms often only allow for execution of code in a configured language, a variety of install scripts among popular languages are provided. 
This could be helpful to diagnose networking or connectivity issues which are specific to these environments.

### Unsavory Use-cases

Tunshell could also be used as an exploitation tool to gain unauthorized access to remote hosts. 
Personally, I hope that this tool is not misused for nefarious purposes. 
If it becomes apparent that tunshell is helping malicious actors go about their activities, the free service will be discontinued.

## How does it work?

Tunshell is comprised of 3 main components:

- [Relay Server](./tunshell-server): a server which is able to coordinate with clients to establish connectivity
- [Client Binary](./tunshell-client): a portable binary acting as a shell server or client.
- [Website](./website): The user interface for configuring a remote shell session with the relay server and providing install scripts for the client.

### Install Script

The process is kicked off using [tunshell.com](https://tunshell.com). 
One can generate a "session" which represents a remote shell connection from one client to another.

For each session the website generates one install script for each side of the connection.
Below is a diagram illustrating the noteworthy components embedded in each script.

![Install Script](https://app.lucidchart.com/publicSegments/view/8ad48e9c-299b-4d55-8c95-2d1aa07475c6/image.png)

- ![#fcc438](https://via.placeholder.com/15/fcc438/000000?text=+) **Installer script URL:** A url pointing to a script which will install the client binary on the executing machine. These scripts detect the host's OS and CPU architecture to download the correct pre-compiled executable.
- ![#834187](https://via.placeholder.com/15/834187/000000?text=+) **Mode argument:** can be target mode (T) or local mode (L). These instruct the client to operate as a shell server or client respectively.
- ![#7ab648](https://via.placeholder.com/15/7ab648/000000?text=+) **Session keys:** a pair of random strings generated by the relay server corresponding to a session. Upon initialisation, these keys are passed back to the relay server. When a pair of clients have sent a corresponding keys, the relay server will begin establishing connectivity between the clients.
- ![#c92d39](https://via.placeholder.com/15/c92d39/000000?text=+) **Encryption secret:** a random secret which is generated locally using javascript on the website. This secret is used to generate a unique encryption key to secure data transmission between the two clients.

### Establishing Connectivity

After the install scripts have executed and the two clients have validated their session keys with the relay server, the following process of attempting to establish a network connection between the two begins.

![Connection Establishment Flow](https://app.lucidchart.com/publicSegments/view/e14f955d-1622-4d34-ba02-3616a1b5b788/image.png)

There are three networking models supported that are attempted and used in the following priority order:

1. **TCP:** The clients will attempt to connect to the peer over TCP directly. 
If both clients are behind a firewall or NAT device, this will likely fail.

![TCP](https://app.lucidchart.com/publicSegments/view/26e86773-55e4-4927-8487-525fde329006/image.png?)

2. **UDP:** The implementation also contains thin [TCP-like protocol built on UDP](./tunshell-client/src/p2p/udp). 
In some cases this can help establish a direct connection if at least of the clients are behind a more permissive NAT device.

![UDP](https://app.lucidchart.com/publicSegments/view/bd4afe42-a282-45d5-8a67-378ae31ad219/image.png?)

3. **Relayed:** In the case where no direct connection succeeds, the clients will fallback to proxying data through the relay server. 
The relay server will traffic packets between the clients using the existing TLS connections initiated by each client.

![Relayed](https://app.lucidchart.com/publicSegments/view/055838d6-6aeb-4a8c-8196-3eadf4653f53/image.png?)

The relayed connection is also used for connections where one of the clients is running in a web browser. 
In which case a Web Socket is used between the client and the relay server on top of TLS.

![Relayed + WS](https://app.lucidchart.com/publicSegments/view/d8f71cde-9585-4811-9fd2-21a81dda061a/image.png?)

### In-built Shell

In some restricted environments the client will not have permission to allocate a PTY. 
This means that running the native shell in an interactive session is not going to be possible. 
The client has a bare-bones (read: incomplete) implementation of a [VT100-style shell](./tunshell-client/src/shell/server/fallback/) which does not require a PTY and is used as a fallback in such cases. 
This is still WIP.

## Security Considerations

Before using tunshell is important to understand inherent risks.
The nature of the application and installation method should trigger alarm bells in any developer's head given we are exposing shell access over a network.
Although a lot of thought has gone into the limiting the attack surface there are is still a lot of room for improvement.

First and foremost, one must always be wary when running scripts from remote sources.
The installation method of the tunshell client relies on the execution of a 3rd party script and binary on the host machine.
If these were to be compromised so would your host. So it's critical that these are produced and delivered in a secure and transparent process.
In summary, the artifacts are generated directly from the source in this repo, stored in AWS S3 and served via CloudFront CDN.

![Artifact Supply Chain](https://app.lucidchart.com/publicSegments/view/fc6f92fa-1b4b-4800-8a2c-2e1c5f72a8ba/image.png)

The next consideration is the operation of the client binary, which exposes shell access over a network channel. 
It is important to state that, although the traffic between clients can be passed through the relay server, effort has gone into ensuring that the relay server is not able to inspect, modify or forge traffic between any two clients. 
This is currently achieved by generating an encryption secret independently of the relay server which is then known to each of the clients.

![Encryption Diagram](https://app.lucidchart.com/publicSegments/view/1a812bff-1780-464e-ba01-ac2913121c77/image.png)

In addition to the secret, during the connection establishment phase, the relay server will generate a unique nonce for each connection pair and send this nonce to each client. 
The clients use the encryption secret and nonce to derive an encryption key using PBKDF2-SHA256. 
The resulting key is unique to this connection and only known to the both clients. The traffic between the clients is then end-to-end encrypted and authenticated using AES-GCM-256.

It is important that the session and encryption keys remain secret. 
Exposing these parameters could allow attackers who obtain these keys to takeover hosts which have an active tunshell client.

## Future Scope

- [ ] Add fallback shell built-in to install https://github.com/uutils/coreutils / busybox
- [ ] Socket forwarding / file copying
- [ ] Replacing AES encryption scheme with TLS using 256 bit ECDH key pairs (public keys can be dual purposed as session keys)
