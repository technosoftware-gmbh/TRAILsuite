# City

A specific city or town. Kept separate from the general Location entity, the same way Landmark is, so a city can anchor its own Accommodation/Landmarks/FnB and (later) show up at the right zoom level on a map view. Always belongs to a Country; State is optional since not every country has one.

## Fields

1. Type
   city
2. Image
   Image of the city
3. Country
   Reference to the Country this city is in
4. State
   Reference to the State this city is in, if the country has states/provinces
5. Geo Location (text input)
   Copy the geolocation from the map view and past it here -- a City has both its place in the Country/State hierarchy above *and* its own specific coordinates, hence two separate fields rather than one
6. Visited (true/false)
   Marks the city as visited
7. Last Visit (select date value from date picker)
8. Tags
    - City

## Example Layout

---
type: city
image: 
country: "[[Austria]]"
state: 
geoLocation:
  - "48.2081743"
  - "16.3738189"
visited: false
lastVisit:
icon: building-2
color: "#25D0F7"
tags:
  - City
created: 
modified: 
---

# Review

# Related Trips
