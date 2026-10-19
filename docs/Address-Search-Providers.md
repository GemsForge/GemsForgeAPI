# Address search providers

The address-create form uses Geoapify Address Autocomplete by default. A user
selects a suggestion, reviews and can edit the returned address values, then
submits through the existing create flow. Manual entry remains available when
the API key is missing or the provider is unavailable. Search fills only the
provided street, city, state/region, postal code, and country values; it never
changes the record ID, type, status, dates, or notes.

## Geoapify setup and attribution

1. Create a Geoapify project and API key in [Geoapify MyProjects](https://myprojects.geoapify.com/).
2. Restrict the key to the Console's allowed web origins/referrers in Geoapify.
   A Vite `VITE_` key is included in browser requests and is not a secret.
3. Copy `Console/.env.example` to `Console/.env.local`, set
   `VITE_GEOAPIFY_API_KEY`, then restart the Console dev server.
4. Do not commit `.env.local` or use an unrestricted key.

The Geoapify Free plan currently lists up to 3,000 credits per day, with one
credit per autocomplete request. Limits and plan details can change; check the
[live pricing page](https://www.geoapify.com/pricing/) before production use.
The Console debounces queries and waits for at least three characters to avoid
spending requests on every keystroke.

When using Geoapify, always show linked `© OpenStreetMap contributors`
attribution. On the Free plan, Geoapify also requires a follow link such as
[Powered by Geoapify](https://www.geoapify.com/). The UI displays both near the
search results; preserve any additional attribution supplied with a result.
See [Geoapify's current terms](https://www.geoapify.com/terms-and-conditions/)
and the [Autocomplete API reference](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/).
