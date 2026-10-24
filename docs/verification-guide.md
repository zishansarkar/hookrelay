# Verify HookRelay webhook signatures

HookRelay sends the signature in `x-hookrelay-signature-256` using this format:

```text
t=<timestamp>,v1=<hmac_hex>
```

The timestamp is Unix time in seconds. The hexadecimal signature is HMAC-SHA256
of the timestamp, a period, and the compact JSON payload:

```text
${timestamp}.${JSON.stringify(payload)}
```

Use the signing secret configured for your endpoint. HookRelay also sends
`x-hookrelay-timestamp` with the same timestamp as the `t` field. Compare the
two values if you use both headers.

## Important: use the same JSON representation

Sign the exact compact JSON representation of the parsed payload: no pretty
printing or added whitespace. JSON serializers differ in how they represent
some Unicode characters, floating-point values, and special values. If your
payload contains such values, preserve the raw UTF-8 request body and use its
bytes after confirming it matches the payload representation sent by HookRelay.
Never parse and reformat JSON in a way that changes the signed content.

## Prevent replay attacks

After parsing the timestamp, reject it when it differs from the receiver's
current Unix time by more than **5 minutes (300 seconds)**. Use a constant-time
comparison for the supplied and calculated signature. Keep clocks synchronized
with a reliable time service.

## Node.js

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyHookRelay(payload, signatureHeader, secret) {
  const match = /^t=(\d+),v1=([a-f0-9]{64})$/i.exec(signatureHeader);
  if (!match) return false;

  const [, timestampText, suppliedHex] = match;
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300)
    return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest();
  const supplied = Buffer.from(suppliedHex, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
```

## Python

```python
import hashlib
import hmac
import json
import re
import time

def verify_hookrelay(payload, signature_header, secret):
    match = re.fullmatch(r"t=(\d+),v1=([a-f0-9]{64})", signature_header)
    if not match:
        return False

    timestamp = int(match.group(1))
    if abs(time.time() - timestamp) > 300:
        return False

    serialized = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    signed = f"{timestamp}.{serialized}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, match.group(2))
```

## Go

```go
func VerifyHookRelay(payload any, signatureHeader, secret string) bool {
    match := regexp.MustCompile(`^t=(\d+),v1=([a-f0-9]{64})$`).
        FindStringSubmatch(signatureHeader)
    if match == nil {
        return false
    }

    timestamp, err := strconv.ParseInt(match[1], 10, 64)
    if err != nil || math.Abs(float64(time.Now().Unix()-timestamp)) > 300 {
        return false
    }

    body, err := json.Marshal(payload)
    if err != nil {
        return false
    }
    mac := hmac.New(sha256.New, []byte(secret))
    _, _ = mac.Write([]byte(strconv.FormatInt(timestamp, 10) + "." + string(body)))
    expected, err := hex.DecodeString(match[2])
    return err == nil && hmac.Equal(mac.Sum(nil), expected)
}
```

Imports for the Go example:

```go
import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "math"
    "regexp"
    "strconv"
    "time"
)
```

## Ruby

```ruby
require "openssl"
require "json"

def verify_hookrelay(payload, signature_header, secret)
  match = /\At=(\d+),v1=([a-f0-9]{64})\z/i.match(signature_header)
  return false unless match

  timestamp = Integer(match[1], 10)
  return false if (Time.now.to_i - timestamp).abs > 300

  signed = "#{timestamp}.#{JSON.generate(payload)}"
  expected = OpenSSL::HMAC.hexdigest("SHA256", secret, signed)
  supplied = match[2]
  return false unless supplied.bytesize == expected.bytesize

  difference = 0
  expected.bytes.zip(supplied.bytes) { |a, b| difference |= a ^ b }
  difference.zero?
end
```

## Test with curl

Compute a fresh timestamp and its matching HMAC for the exact compact JSON
payload, then send both signature headers to your receiver. Avoid putting real
secrets directly in shell history.

```sh
export RECEIVER_URL="https://your-receiver.example/webhooks"
export TIMESTAMP="$(date +%s)"
export PAYLOAD='{"event":"test","id":"evt_test"}'
# Set SIGNATURE to the HMAC-SHA256 hex digest of:
#   ${TIMESTAMP}.${PAYLOAD}
export SIGNATURE="computed-hmac-hex"

curl -i -X POST "$RECEIVER_URL" \
  -H "Content-Type: application/json" \
  -H "x-hookrelay-timestamp: $TIMESTAMP" \
  -H "x-hookrelay-signature-256: t=$TIMESTAMP,v1=$SIGNATURE" \
  --data-binary "$PAYLOAD"
```

The dashboard-authenticated test endpoint can also validate a locally captured
signature before you deploy your receiver:

```sh
curl -i -X POST "$HOOKRELAY_URL/v1/webhooks/test" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  --data-binary "{\"signingSecret\":\"$SIGNING_SECRET\",\"headers\":{\"x-hookrelay-signature-256\":\"t=$TIMESTAMP,v1=$SIGNATURE\",\"x-hookrelay-timestamp\":\"$TIMESTAMP\"},\"body\":$PAYLOAD}"
```

It returns `{ "valid": true }` only when the signature and timestamp are valid.
Treat the test endpoint as a development aid: use TLS and never log or share
the signing secret.
