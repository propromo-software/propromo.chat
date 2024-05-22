#!/bin/bash
echo -e "# Don't add passphrase"
ssh-keygen -t rsa -b 4096 -m PEM -E SHA512 -f ./docs/dummy/jwtRS512.key -N ""
# Don't add passphrase
openssl rsa -in ./docs/dummy/jwtRS512.key -pubout -outform PEM -out ./docs/dummy/jwtRS512.key.pub
cat ./docs/dummy/jwtRS512.key
cat ./docs/dummy/jwtRS512.key.pub
