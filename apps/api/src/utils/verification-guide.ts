export const verificationGuide = {
  title: 'Verifying HookRelay webhook signatures',
  signatureFormat: 't=<timestamp>,v1=<hmac_hex>',
  signedContent: '${timestamp}.${JSON.stringify(payload)}',
  replayProtection:
    'Reject signatures whose timestamp is more than 5 minutes from the current time.',
  examples: {
    nodejs: `import { createHmac, timingSafeEqual } from 'node:crypto';

function verifyHookRelay(payload, signatureHeader, secret) {
  const match = /^t=(\\d+),v1=([a-f0-9]{64})$/i.exec(signatureHeader);
  if (!match) return false;
  const [, timestampText, suppliedHex] = match;
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret)
    .update(\`\${timestamp}.\${JSON.stringify(payload)}\`)
    .digest();
  const supplied = Buffer.from(suppliedHex, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}`,
    python: `import hashlib
import hmac
import json
import re
import time

def verify_hookrelay(payload, signature_header, secret):
    match = re.fullmatch(r"t=(\\d+),v1=([a-f0-9]{64})", signature_header)
    if not match:
        return False
    timestamp = int(match.group(1))
    if abs(time.time() - timestamp) > 300:
        return False
    serialized = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    signed = f"{timestamp}.{serialized}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, match.group(2))`,
    go: `func VerifyHookRelay(payload any, signatureHeader, secret string) bool {
    match := regexp.MustCompile(\`^t=(\\d+),v1=([a-f0-9]{64})$\`).FindStringSubmatch(signatureHeader)
    if match == nil { return false }
    timestamp, err := strconv.ParseInt(match[1], 10, 64)
    if err != nil || math.Abs(float64(time.Now().Unix()-timestamp)) > 300 { return false }
    body, err := json.Marshal(payload)
    if err != nil { return false }
    mac := hmac.New(sha256.New, []byte(secret))
    _, _ = mac.Write([]byte(strconv.FormatInt(timestamp, 10) + "." + string(body)))
    expected, err := hex.DecodeString(match[2])
    return err == nil && hmac.Equal(mac.Sum(nil), expected)
}`,
    ruby: `require "openssl"
require "json"

def verify_hookrelay(payload, signature_header, secret)
  match = /\\At=(\\d+),v1=([a-f0-9]{64})\\z/i.match(signature_header)
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
end`,
  },
  curl: {
    description:
      'Use a recent timestamp and compute the matching HMAC for the exact compact JSON payload before sending. Keep the signing secret out of shell history in real deployments.',
    command:
      'curl -i -X POST "$RECEIVER_URL" -H "Content-Type: application/json" -H "x-hookrelay-timestamp: $TIMESTAMP" -H "x-hookrelay-signature-256: t=$TIMESTAMP,v1=$SIGNATURE" --data-binary "$PAYLOAD"',
  },
} as const;
