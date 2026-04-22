# Limitations

- Binance market endpoints are dynamic, so direct-fetch and attested responses can differ slightly in value or timestamp.
- Long arrays such as order books or long kline windows are not first-release proof targets.
- Signed endpoints are supported by the helper layer but are not turned on as default demos in the first release.
- A zkTLS proof for a Binance action endpoint does not establish final trade execution or settlement.
- Alpha endpoints can change shape faster than spot and futures docs, so keep field extraction narrow and defensive.
