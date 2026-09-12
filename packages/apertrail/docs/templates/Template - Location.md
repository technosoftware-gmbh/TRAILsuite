# Location

Under "Location", we collect any place that is neither a Landmark, nor an Accommodation, nor a place to eat or drink (see FnB).

## Fields

1. Type
   location
2. Image 
   Image of the location   
3. Country
   The country the location is in
4. City
   Reference to the City this location is in, if it's inside a tracked City -- falls back to just Country when it isn't
5. Geo Location (text input)
   Copy the geolocation from the map view and past it here -- named `geoLocation` rather than `location` so it doesn't collide with this entity type's own name
6. Visited (true/false)
   Marks a location as visited
7. Last Visit (select date value from date picker)
8. Rating (1-5)
9. Tags
    - Travel/Location

## Example Layout

---
type: location
image:
country: "[[Austria]]"
city: "[[Vienna]]"
geoLocation:
  - "48.24820285"
  - "16.449655116101702"
visited: false
lastVisit:
icon: map-pin
color: "#FFD700"
rating:
summary:
tags:
  - Travel/Location
created: "2024-03-28T14:23"
modified: "2025-10-08T17:27"
---

# Review

# Related Trips
