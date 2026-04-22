# Fallback Decision Trees

## Public market-data requests

1. Is there a narrow endpoint with a stable JSON shape?
   - yes -> attested flow
2. Is the payload large but reducible to one row or one latest value?
   - yes -> partial flow with a smaller query
3. Is the user asking for a large history window or a full book?
   - yes -> fallback or offer a latest-snapshot proof

## Signed private queries

1. Is the request read-only?
   - yes -> possible partial flow
2. Does the response contain a large asset array or many positions?
   - yes -> narrow to one symbol, one asset, or one order
3. Would the proof reveal unnecessary sensitive fields?
   - yes -> do not attest the broad payload

## Exchange actions

1. Is the endpoint placing, cancelling, borrowing, repaying, or transferring?
   - yes -> not a default proof target
2. Does the user explicitly want request-response proof?
   - yes -> use a partial flow and state limitations clearly
3. Does the user actually need execution or settlement truth?
   - yes -> zkTLS alone is insufficient
