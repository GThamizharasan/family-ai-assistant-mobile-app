---
name: routes-api-web-api
description: Use this skill when generating directions, calculating travel distances and times, or computing route matrices between multiple origins and destinations using the Google Maps Platform Routes API (HTTP REST). Apply this skill to requests involving route polylines, step-by-step maneuvers, toll calculations, waypoint optimization, traffic-aware routing, eco-friendly routes, or specific travel modes (drive, transit, walk, two-wheeled).
license: Apache-2.0
metadata:
  version: 1.0.56
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

The Google Maps Platform Routes API is a web service accessed via HTTP REST
requests to calculate directions and route matrices between geographic
locations. Use this skill to construct API requests, configure field masks, and
handle response payloads for two core routing operations:

-   **Compute Routes**: Calculate optimal paths between an origin, a
    destination, and optional intermediate waypoints. Retrieve route-level and
    step-by-step data including distances, travel durations, encoded polylines,
    maneuver descriptions, and toll information. Customize requests with travel
    modes, traffic preferences, route modifiers (such as avoiding highways or
    tolls), vehicle headings, pass-through points, waypoint order optimization,
    and eco-friendly or shorter-distance routing.
-   **Compute Route Matrix**: Evaluate distances, travel times, and toll details
    across a matrix of multiple origins and destinations to determine the most
    efficient pairings for specified travel modes.

## Primary Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### Phase 1: Feature Layer & Custom Enrichment (Supplemental)

#### Feature Module: Routes (Optional - Use-Case Dependent)

-   [ ] **Returns step-by-step route directions as a series of
    latitude/longitude coordinates between two or more locations using the
    computeRoutes HTTP REST endpoint.** Read
    [references/return-directions-between-two-or-more-latitudelongitude-coordinates-as-series-coordinates-each-step.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-directions-between-two-or-more-latitudelongitude-coordinates-as-series-coordinates-each-step.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to retrieve the start and end
    coordinates for each individual step along a route. *Evidence Checkpoint*:
    Verify that the HTTP POST request to computeRoutes includes a field mask
    requesting step startLocation and endLocation, and returns a 200 OK JSON
    response with step coordinates.
-   [ ] **Returns step-by-step turn-by-turn maneuver instructions and
    descriptions along a route between coordinates via the computeRoutes
    endpoint.** Read
    [references/return-directions-between-two-or-more-sets-latitudelongitude-coordinates-as-series-maneuver-descript.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-directions-between-two-or-more-sets-latitudelongitude-coordinates-as-series-maneuver-descript.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user needs human-readable navigation
    instructions or maneuver types for each step of a route. *Evidence
    Checkpoint*: Verify that the HTTP POST request to computeRoutes specifies
    routes.legs.steps.navigationInstruction in the X-Goog-FieldMask header and
    returns step maneuver descriptions.
-   [ ] **Returns the distance in meters for each individual navigation step
    along a route between two or more coordinates.** Read
    [references/return-distance-between-each-step-along-route-between-two-or-more-sets-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-distance-between-each-step-along-route-between-two-or-more-sets-latitudelongitude-coordinates.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to calculate the distance of
    each individual step or segment within a route leg. *Evidence Checkpoint*:
    Verify that the X-Goog-FieldMask header includes
    routes.legs.steps.distanceMeters and the JSON response contains distance
    values for each step.
-   [ ] **Returns the estimated travel duration for each individual step along a
    route between two or more coordinates.** Read
    [references/return-travel-time-between-each-step-along-route-between-two-or-more-sets-latitudelongitude-coordina.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-travel-time-between-each-step-along-route-between-two-or-more-sets-latitudelongitude-coordina.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user needs the travel time or duration for
    each individual step along a route. *Evidence Checkpoint*: Verify that the
    X-Goog-FieldMask header includes routes.legs.steps.staticDuration and the
    JSON response provides duration strings for each step.
-   [ ] **Returns an encoded polyline string representing the geometry of each
    individual step along a route.** Read
    [references/return-encoded-polyline-between-each-step-along-route-between-two-or-more-set-latitudelongitude-coor.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-encoded-polyline-between-each-step-along-route-between-two-or-more-set-latitudelongitude-coor.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to render or inspect the path
    geometry of individual steps along a route. *Evidence Checkpoint*: Verify
    that the X-Goog-FieldMask header includes
    routes.legs.steps.polyline.encodedPolyline and the JSON response includes
    encoded polyline strings per step.
-   [ ] **Returns the total distance in meters for an entire route or route legs
    between origin and destination coordinates.** Read
    [references/return-distance-route-between-two-or-more-sets-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-distance-route-between-two-or-more-sets-latitudelongitude-coordinates.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to get the overall distance of
    a route between two or more locations. *Evidence Checkpoint*: Verify that
    the X-Goog-FieldMask header includes routes.distanceMeters and the HTTP 200
    OK JSON payload returns the total route distance.
-   [ ] **Returns the total estimated travel duration for an entire route
    between two or more sets of coordinates.** Read
    [references/return-travel-time-route-between-two-or-more-sets-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-travel-time-route-between-two-or-more-sets-latitudelongitude-coordinates.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to calculate the total travel
    time or duration for a route. *Evidence Checkpoint*: Verify that the
    X-Goog-FieldMask header includes routes.duration and the JSON response
    returns the total route duration.
-   [ ] **Returns the overall encoded polyline representing the full geometry of
    a route between two or more coordinates.** Read
    [references/return-encoded-polyline-route-between-two-or-more-sets-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-encoded-polyline-route-between-two-or-more-sets-latitudelongitude-coordinates.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user needs the complete route polyline to
    draw or display the entire path on a map. *Evidence Checkpoint*: Verify that
    the X-Goog-FieldMask header includes routes.polyline.encodedPolyline and the
    JSON response contains the encoded polyline for the route.
-   [ ] **Returns estimated toll fees and toll pass information for a route
    between two or more sets of coordinates.** Read
    [references/return-toll-information-route-between-two-or-more-sets-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-toll-information-route-between-two-or-more-sets-latitudelongitude-coordinates.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to calculate toll costs or
    check for toll roads along a specific route. *Evidence Checkpoint*: Verify
    that extraComputations includes TOLLS in the request body and
    routes.travelAdvisory.tollInfo is present in the X-Goog-FieldMask header.
-   [ ] **Configures the mode of transportation (DRIVE, TRANSIT, WALK, BICYCLE,
    or TWO_WHEELER) in a computeRoutes request.** Read
    [references/specify-travel-mode-drive-transit-walk-two-wheeled-route-request.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/specify-travel-mode-drive-transit-walk-two-wheeled-route-request.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to specify or change the travel
    mode for calculating directions. *Evidence Checkpoint*: Verify that the
    travelMode field in the computeRoutes JSON request payload is set to a valid
    enum value.
-   [ ] **Defines intermediate waypoints along a route as either stopping points
    or pass-through (via) points.** Read
    [references/specify-stop-or-pass-through-point-route-request.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/specify-stop-or-pass-through-point-route-request.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to add stops or pass-through
    waypoints to a route request. *Evidence Checkpoint*: Verify that the
    intermediates array is populated in the computeRoutes request body with the
    appropriate via boolean flag.
-   [ ] **Configures the routingPreference (TRAFFIC_UNAWARE, TRAFFIC_AWARE, or
    TRAFFIC_AWARE_OPTIMAL) to control how live and historical traffic conditions
    affect route calculation.** Read
    [references/specify-how-traffic-data-is-used-route-request.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/specify-how-traffic-data-is-used-route-request.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to factor real-time traffic
    into route calculations or balance routing latency vs traffic accuracy.
    *Evidence Checkpoint*: Verify that the routingPreference parameter is
    properly set in the computeRoutes JSON request body.
-   [ ] **Sets routeModifiers in a route request to avoid specific road features
    such as tolls, highways, ferries, or indoor steps.** Read
    [references/specify-features-avoid-such-as-highways-or-tolls-route-request.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/specify-features-avoid-such-as-highways-or-tolls-route-request.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to calculate a route that
    avoids tolls, highways, ferries, or indoor navigation. *Evidence
    Checkpoint*: Verify that the routeModifiers object in the request body sets
    avoidTolls, avoidHighways, avoidFerries, or avoidIndoor to true.
-   [ ] **Defines the origin and destination waypoints for a route request using
    latitude/longitude coordinates, Place IDs, or address strings.** Read
    [references/set-waypoints-along-route.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/set-waypoints-along-route.md).
    *Trigger Condition*: Use when constructing any route request to set the
    starting origin and ending destination locations. *Evidence Checkpoint*:
    Verify that the origin and destination fields are properly formatted in the
    computeRoutes JSON request body.
-   [ ] **Adds one or more intermediate stop waypoints between the origin and
    destination of a route.** Read
    [references/set-intermediate-waypoints-along-route.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/set-intermediate-waypoints-along-route.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants a route that visits multiple
    stops in sequence between the origin and destination. *Evidence Checkpoint*:
    Verify that the intermediates array is included in the computeRoutes JSON
    request body and yields multiple route legs in the response.
-   [ ] **Configures an intermediate waypoint with `via: true` so the route
    passes through the location without creating a stopover or splitting the
    route into separate legs.** Read
    [references/set-point-route-pass-through.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/set-point-route-pass-through.md).
    *Dependencies*: `["references/set-waypoints-along-route.md",
    "references/set-intermediate-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to force a route along a
    specific path or through a waypoint without treating it as a stop. *Evidence
    Checkpoint*: Verify that the waypoint in the intermediates array sets
    `via: true` in the computeRoutes request body.
-   [ ] **Specifies the compass heading and sideOfRoad preference for a waypoint
    to control arrival or departure direction.** Read
    [references/specify-vehicle-heading-and-side-road-route.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/specify-vehicle-heading-and-side-road-route.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants the route to arrive on a
    specific side of the street or depart in a specific compass direction.
    *Evidence Checkpoint*: Verify that the waypoint object in the request body
    includes the heading integer or `sideOfRoad: true` property.
-   [ ] **Optimizes the sequence of intermediate waypoints to find the most
    efficient traveling salesperson path.** Read
    [references/optimize-order-stops-your-route.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/optimize-order-stops-your-route.md).
    *Dependencies*: `["references/set-waypoints-along-route.md",
    "references/set-intermediate-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to automatically reorder
    intermediate stops to minimize total travel time. *Evidence Checkpoint*:
    Verify that `optimizeWaypointOrder: true` is set in the request body and
    `routes.optimizedIntermediateWaypointIndex` is included in the
    X-Goog-FieldMask header.
-   [ ] **Requests fuel-efficient or energy-optimized routes based on the
    vehicle's engine emission type (gasoline, electric, hybrid, or diesel).**
    Read
    [references/specify-eco-friendly-routing-routes-request.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/specify-eco-friendly-routing-routes-request.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants to compute an eco-friendly
    route or estimate fuel/energy consumption. *Evidence Checkpoint*: Verify
    that `requestedReferenceRoutes` includes `FUEL_EFFICIENT`,
    `vehicleInfo.emissionType` is set, and the field mask requests fuel
    consumption and route labels.
-   [ ] **Requests alternative routes or a shorter-distance reference route in
    addition to the default fastest route.** Read
    [references/specify-shorter-distance-or-alternative-routing-routes-request.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/specify-shorter-distance-or-alternative-routing-routes-request.md).
    *Dependencies*: `["references/set-waypoints-along-route.md"]` \
    *Trigger Condition*: Use when the user wants multiple alternative routes or
    explicitly requests the shortest distance route. *Evidence Checkpoint*:
    Verify that `computeAlternativeRoutes: true` or
    `requestedReferenceRoutes: ["SHORTER_DISTANCE"]` is present in the request
    body and `routes.routeLabels` is in the field mask.
-   [ ] **Computes a matrix of route distances between multiple origin and
    destination pairs using the computeRouteMatrix HTTP endpoint.** Read
    [references/return-distances-matrix-routes-between-multiple-origins-and-destinations.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-distances-matrix-routes-between-multiple-origins-and-destinations.md).
    *Trigger Condition*: Use when the user wants to calculate distances between
    many origins and destinations in a single matrix request. *Evidence
    Checkpoint*: Verify that the HTTP POST request to computeRouteMatrix
    includes origins and destinations arrays and specifies distanceMeters in the
    X-Goog-FieldMask header.
-   [ ] **Computes a matrix of travel durations between multiple origin and
    destination pairs using the computeRouteMatrix HTTP endpoint.** Read
    [references/return-travel-times-matrix-routes-between-multiple-origins-and-destinations.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-travel-times-matrix-routes-between-multiple-origins-and-destinations.md).
    *Trigger Condition*: Use when the user wants to compare travel times across
    multiple origins and destinations using a route matrix. *Evidence
    Checkpoint*: Verify that the HTTP POST request to computeRouteMatrix
    includes origins and destinations arrays and specifies duration in the
    X-Goog-FieldMask header.
-   [ ] **Returns estimated toll fees for each origin-destination pair in a
    computeRouteMatrix request.** Read
    [references/return-toll-information-matrix-routes-between-multiple-origins-and-destinations.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/return-toll-information-matrix-routes-between-multiple-origins-and-destinations.md).
    *Dependencies*:
    `["references/return-distances-matrix-routes-between-multiple-origins-and-destinations.md"]` \
    *Trigger Condition*: Use when the user needs toll cost information across a
    matrix of multiple origins and destinations. *Evidence Checkpoint*: Verify
    that the computeRouteMatrix request includes `extraComputations: ["TOLLS"]`
    in the body and `travelAdvisory.tollInfo` in the X-Goog-FieldMask header.
-   [ ] **Configures the travel mode (DRIVE, TRANSIT, WALK, BICYCLE, or
    TWO_WHEELER) for a computeRouteMatrix request.** Read
    [references/specify-travel-mode-drive-transit-walk-two-wheeled-route-matrix-request.md](https://www.gstatic.com/googlemapsplatform-agent-skills/routes-api-web-api/references/specify-travel-mode-drive-transit-walk-two-wheeled-route-matrix-request.md).
    *Dependencies*:
    `["references/return-distances-matrix-routes-between-multiple-origins-and-destinations.md"]` \
    *Trigger Condition*: Use when the user wants to set the mode of
    transportation for calculating a route matrix. *Evidence Checkpoint*: Verify
    that the `travelMode` property is set to a valid mode in the
    computeRouteMatrix JSON request body.
