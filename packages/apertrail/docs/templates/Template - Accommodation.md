# Accommodation

Used to keep track of the various accommodations you used - or want to use - when travelling. The system is set up to let you re-use accommodations for multiple trips.

## Fields

1. Type
   accommodation
2. Image 
   Image of the accommodation  
3. Country
   The country the location is in
4. City
   Reference to the City this accommodation is in, if it's inside a tracked City -- falls back to just Country when it isn't
5. Geo Location (text input)
   Copy the geolocation from the map view and past it here
6. Accommodation Type (select single value from list)
    - Apartment
    - Hotel
    - House
7. Accommodation Status (select single value from list)
    - Booked
    - Cancelled
    - Not available
    - Reserved
8. Visited (true/false)
   Marks an accommodation as visited
9. Last Visit (select date value from date picker)
10. Rating (1-5)
11. Tags
    - Travel/Accommodation

## Example Layout

---
type: accommodation
image:
country: "[[Austria]]"
city: "[[Vienna]]"
geoLocation:
  - "48.2247911"
  - "16.4559853"
accommodationType: Apartment
accommodationStatus: Booked
visited: true
lastVisit:
icon: hotel
color: "#77C66B"
rating: 4
summary:
tags:
  - Travel/Accommodation
created: "2026-08-01T14:21"
modified: "2026-08-03T17:03"
---

# Review

# Related Trips
