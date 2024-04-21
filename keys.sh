#!/bin/bash
echo -e "# Don't add passphrase"
ssh-keygen -t rsa -b 4096 -m PEM -E SHA512 -f ./dummy/jwtRS512.key -N ""
# Don't add passphrase
openssl rsa -in ./dummy/jwtRS512.key -pubout -outform PEM -out ./dummy/jwtRS512.key.pub
cat ./dummy/jwtRS512.key
cat ./dummy/jwtRS512.key.pub
