# Landmark

This entity comprises notes for specific landmarks. While these are also locations from a technical point of view, the dedicated entity makes it easier to organize them and highlight them on the map view.

## Fields

1. Type
   landmark
2. Image 
   Image of the location   
3. Country
   The country the location is in
4. City
   Reference to the City this landmark is in, if it's inside a tracked City -- falls back to just Country when it isn't
5. Geo Location (text input)
   Copy the geolocation from the map view and past it here
6. Visited (true/false)
   Marks a location as visited
7. Last Visit (select date value from date picker)
8. Rating (1-5)
9. Tags
    - Travel/Location
    - Landmark

## Example Layout

---
type: landmark
image:
country: "[[France]]"
city: "[[Paris]]"
geoLocation:
  - "48.8582599"
  - "2.2945006358633115"
visited: true
lastVisit: 2023-01-06
icon: landmark
color: "#FC3634"
rating: 3
tags:
  - Travel/Location
  - Landmark/Building
  - LeanDemo
created: "2024-03-26T15:04"
modified: "2025-10-08T17:25"
---

# Review

# Related Trips
