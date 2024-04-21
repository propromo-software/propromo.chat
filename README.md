# Propromo Chat

## Description

A chat application for Propromo.

### Server Commands

```
deno task start
```

### Keys

#### RS512 (for production)

Use `keys.sh` or one of the commands.

##### private.pem

Generates a private key with a 4096-bit RSA key and SHA-512 digest, but it does not generate a certificate. The private key is encrypted with AES-256 and output to the private.pem file.

```
openssl genpkey -algorithm RSA -out private.pem -aes256 -pkeyopt rsa_keygen_bits:4096 -pkeyopt digest:sha512
```

or

Generates a self-signed X.509 certificate with a 4096-bit RSA key and SHA-512 digest. The private key is encrypted with the specified digest algorithm and output to the private.pem file.

```
openssl req -x509 -newkey rsa:4096 -keyout private.pem -out private.pem -days 3650 -nodes -subj '/CN=propromo.chat' -sha512
```

###### Check

```
openssl rsa -in private.pem -check
```

##### public.pem

The public key is not generated separately, but it can be extracted from the private key using the `openssl rsa` command with the `-pubout` option, like this:

```
openssl rsa -in private.pem -pubout -outform PEM -out public.pem
```

or

The public key is embedded in the self-signed X.509 certificate that is generated along with the private key.

```
openssl x509 -in private.pem -pubkey -noout > public.pem
```

#### HS256 (for development)

```
openssl rand -base64 32
```
