# Apple Maps address search

The address creation form can search Apple Maps suggestions and autofill the
matching address fields. The user reviews and may edit the values before
creating the record. Stable address ID, address type, status, dates, and notes
remain under the user's control and are never overwritten by a map selection.

## Local setup

1. Create a MapKit JS token in Apple Developer → Certificates, Identifiers &
   Profiles → Services → Maps. Restrict it to the app's web domain.
2. Copy `Console/.env.example` to `Console/.env.local` and set
   `VITE_MAPKIT_JS_TOKEN` to the token.
3. Restart the Console dev server or rebuild the Console bundle.

The token is used by browser-side MapKit JS and is visible to browser clients;
use a domain-restricted token and never commit the populated `.env.local` file.
Without a configured token, manual address entry remains available.

The integration uses MapKit JS autocomplete followed by a search for the
selected suggestion to obtain structured place details. It copies street,
locality, administrative area, postal code, and country into their matching
form fields when those values are present.

## References

- [Creating a Maps token](https://developer.apple.com/documentation/mapkitjs/creating-a-maps-token)
- [MapKit JS autocomplete](https://developer.apple.com/documentation/mapkitjs/search/autocomplete)
- [MapKit JS search](https://developer.apple.com/documentation/mapkitjs/search/search)
- [MapKit JS Place fields](https://developer.apple.com/documentation/mapkitjs/place)
