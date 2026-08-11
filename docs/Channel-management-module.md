# MEALIEZ — MASTER IMPLEMENTATION PROMPT
# Channel Management + GPS-Based Channel Attendance
# Enterprise Civil/Infrastructure Attendance Module

You are working on the existing Mealiez SaaS codebase.

Your task is to implement a production-ready "Channel Management" and "Channel-Based Attendance" system for enterprise/civil/infrastructure customers such as DHD Infra.

IMPORTANT:
DO NOT rebuild the application from scratch.
DO NOT replace the existing Branch Management system.
DO NOT break existing branch-based attendance.
DO NOT introduce unnecessary architectural changes.
FIRST inspect the existing codebase, database schema, authentication, RLS policies, attendance/session implementation, user profile implementation, Branch Management UI, and existing design system.

The new Channel system must integrate naturally into the existing Mealiez architecture.

============================================================
1. BUSINESS CONTEXT
============================================================

Mealiez currently supports Branch-based attendance.

Every user/worker can be assigned to a Branch, and attendance sessions are created against a Branch.

For civil/infrastructure companies such as DHD Infra, workers operate at specific physical work locations.

These physical work locations are called "Channels".

A Channel represents a defined geographical work zone.

Example:

DHD Infra Project A

    Channel 01
    Channel 02
    Channel 03
    Channel 04

Each Channel has geographical information such as:

- Channel name
- Channel code / ID
- Latitude
- Longitude
- Radius OR polygon/geofence boundary
- Project/Site
- Status

The company has provided KML files containing Channel geographical coordinates/boundaries.

The system must allow admins to import/manage these Channels.

During Channel-based attendance:

1. Worker scans the attendance QR.
2. The system requests the worker's current location.
3. Device returns latitude/longitude and GPS accuracy.
4. Backend determines which Channel contains/is closest to the worker's coordinates.
5. The detected Channel is used for attendance.
6. The user's assigned channel is used for validation.
7. If detected Channel matches assigned Channel, attendance is verified.
8. If detected Channel differs from assigned Channel, the system must NOT silently mark attendance as normal.
9. GPS failure must be handled as a controlled fallback/exception.

============================================================
2. CORE PRODUCT PRINCIPLE
============================================================

Branch and Channel are NOT replacements for each other.

They represent different concepts.

BRANCH:
Administrative / organizational grouping.

CHANNEL:
Physical / geographical work location.

Existing Branch functionality MUST continue to work.

The system must support:

ATTENDANCE_MODE = BRANCH
ATTENDANCE_MODE = CHANNEL

The architecture should also be capable of supporting HYBRID behavior in the future, but do not expose or implement a Hybrid mode unless the existing architecture requires it.

============================================================
3. FIRST STEP — CODEBASE AUDIT
============================================================

Before modifying anything:

Inspect the complete relevant codebase.

Identify:

1. Framework and version
2. Frontend architecture
3. Backend architecture
4. Supabase/PostgreSQL usage
5. Authentication implementation
6. User/profile tables
7. Branch tables
8. Branch management components
9. Attendance tables
10. Attendance session tables
11. Session creation modal/page
12. QR attendance flow
13. RLS policies
14. Storage architecture
15. Existing map/geolocation libraries
16. Existing UI component library
17. Existing form validation library
18. Existing notification/toast system
19. Existing audit logging
20. Existing database migration structure

Search the repository before creating new files.

Reuse existing:

- components
- hooks
- services
- API patterns
- Supabase clients
- database conventions
- validation utilities
- modal/dialog patterns
- table patterns
- form patterns
- design tokens
- icons
- loading states
- error handling
- permission checks

Do not create duplicate infrastructure if an equivalent already exists.

After the audit, determine the smallest safe implementation path.

============================================================
4. EXISTING BRANCH FUNCTIONALITY MUST REMAIN INTACT
============================================================

This is a HARD REQUIREMENT.

Existing:

- Branch Management
- Branch assignment
- Branch-based attendance
- Branch filters
- Existing attendance reports
- Existing attendance sessions
- Existing user management

must continue working exactly as before.

Do NOT rename Branch to Channel.

Do NOT migrate existing Branch records into Channels.

Do NOT remove branch_id from existing data.

Do NOT change existing Branch attendance behavior.

The new Channel system must be additive.

============================================================
5. ATTENDANCE MODE
============================================================

Introduce an attendance mode.

Supported values:

BRANCH
CHANNEL

Prefer an enum or equivalent strongly typed representation according to the existing project's conventions.

The attendance mode must be stored on the Attendance Session.

Example:

attendance_sessions:

id
tenant_id
session_date
meal_type
label
attendance_mode
branch_id
project_id
scan_mode
status
created_by
created_at
updated_at

Branch session:

attendance_mode = BRANCH
branch_id = <branch>

Channel session:

attendance_mode = CHANNEL
project_id = <project>

IMPORTANT:

The SESSION'S attendance_mode is the source of truth for attendance processing.

Do not dynamically decide attendance mode from the current organization setting after the session has already been created.

============================================================
6. SESSION CREATION UI
============================================================

The existing "Start New Session" UI currently contains approximately:

- Session Date
- Meal Type
- Label
- Mess Branch
- Initial Scan Mode
- Cancel
- Start Session

Modify this UI minimally.

Add:

ATTENDANCE LOCATION

A segmented control / radio-card control:

[ Branch Based ] [ Channel Based ]

Default to Branch Based so existing behavior remains backward compatible.

------------------------------------------------------------
BRANCH MODE
------------------------------------------------------------

When Branch Based is selected:

Show the existing:

Mess Branch
[ branch dropdown ]

Do not change existing behavior.

------------------------------------------------------------
CHANNEL MODE
------------------------------------------------------------

When Channel Based is selected:

Do NOT show a Channel dropdown.

Instead show:

Project / Site
[ project/site dropdown ]

And an informational message:

"Channel will be automatically detected using the worker's GPS location."

Optional helper text:

"Workers must allow location access when scanning the attendance QR."

The system must automatically detect the worker's Channel.

============================================================
7. CHANNEL MANAGEMENT MODULE
============================================================

Create a new Channel Management module.

It should follow the SAME UX and architectural pattern as the existing Branch Management module.

Do not invent a completely different design language.

Reuse the existing:

- page layout
- sidebar
- table
- modal
- form
- search
- pagination
- filters
- status badges
- confirmation dialogs
- toast messages
- loading states
- empty states

Navigation should conceptually become:

MANAGEMENT

    Branches
    Channels

or follow the existing application's actual navigation conventions.

============================================================
8. CHANNEL ENTITY
============================================================

Create a Channel entity/table using the existing database conventions.

Recommended logical structure:

channels

id
tenant_id
project_id / site_id
name
code
description
geometry_type
latitude
longitude
radius
geometry
status
metadata
created_by
created_at
updated_at

IMPORTANT:

Adapt this to the actual existing schema.

Do not blindly use these exact column names if the codebase has established naming conventions.

------------------------------------------------------------
GEOMETRY TYPES
------------------------------------------------------------

Support:

1. POINT + RADIUS
2. POLYGON

geometry_type:

POINT_RADIUS
POLYGON

For POINT_RADIUS:

latitude
longitude
radius

For POLYGON:

geometry / polygon geometry

Use PostGIS if PostgreSQL/Supabase architecture supports it.

Prefer native PostGIS spatial operations instead of implementing fragile geographic calculations manually.

============================================================
9. CHANNEL MANAGEMENT UI
============================================================

Create:

Channels page

Features:

- List channels
- Search
- Filter by project/site
- Filter by status
- Add Channel
- Edit Channel
- View Channel
- Activate/Deactivate
- View assigned workers
- Import KML

Example:

----------------------------------------------------
Channels

[Search Channels] [Project ▼] [Status ▼]

[Import KML] [+ Add Channel]

Channel       Project       Workers     Status
----------------------------------------------------
CH-01         Project A     42          Active
CH-02         Project A     31          Active
CH-03         Project B     27          Active
----------------------------------------------------

Use actual existing design conventions.

============================================================
10. ADD CHANNEL FORM
============================================================

Create Channel form.

Fields:

Channel Name
Channel Code / ID
Project / Site
Description

Location Type:

( ) Point + Radius
( ) Polygon

For Point + Radius:

Latitude
Longitude
Radius (meters)

For Polygon:

Polygon boundary / geometry

Status:

Active / Inactive

Validation:

- Name required
- Code required
- Project required if projects are supported
- Latitude between -90 and 90
- Longitude between -180 and 180
- Radius > 0
- Polygon must be valid
- Prevent duplicate channel codes within the relevant tenant/project scope
- Sanitize all input

============================================================
11. KML IMPORT
============================================================

This is an important feature.

DHD Infra has provided KML files containing Channel coordinates/geometries.

Implement:

[Import KML]

Flow:

1. Upload KML
2. Parse KML
3. Extract placemarks/geometries
4. Extract channel name/code where available
5. Extract coordinates
6. Detect geometry type
7. Validate geometry
8. Show preview
9. Allow admin to review
10. Import only after explicit confirmation

NEVER directly insert raw KML data into production.

------------------------------------------------------------
KML IMPORT PREVIEW
------------------------------------------------------------

Show:

Imported Channels

✓ CH-01     Valid
✓ CH-02     Valid
✓ CH-03     Valid
⚠ CH-04     Invalid geometry

Provide:

- Map preview if map infrastructure exists
- Channel name
- Geometry type
- Coordinates/boundary
- Validation status
- Error message

Buttons:

[Cancel]
[Import Valid Channels]

Do not import invalid records.

============================================================
12. MAP UI
============================================================

If the project already uses a map library, reuse it.

Otherwise select a lightweight production-ready map solution compatible with the existing architecture.

Preferred options depending on current stack:

- Leaflet
- MapLibre
- Google Maps only if already integrated

Do NOT add a paid map provider unnecessarily.

Channel Management should support:

LIST VIEW
MAP VIEW

Map should display:

- Channel boundaries
- Channel labels
- Radius circles where applicable
- Channel status
- Optional worker location where permission exists

Clicking a Channel should open its details.

============================================================
13. USER PROFILE — CHANNEL ASSIGNMENT
============================================================

Add:

channel_id

to the user/worker profile if the current schema supports a direct assignment.

A worker can have ONE currently assigned Channel in the V1 implementation.

Example:

User:

Rahul Sharma
Employee ID: DHD-10234

Branch:
Pune East

Channel:
CH-07

The Channel dropdown must only display valid Channels available to the user's tenant/project according to the application's access model.

Reuse existing user assignment patterns.

============================================================
14. IMPORTANT — CHANNEL ASSIGNMENT IS NOT CHANNEL DETECTION
============================================================

This distinction is mandatory.

user.channel_id means:

"Which Channel is this worker currently assigned to?"

It does NOT mean:

"Which Channel is the worker currently physically standing in?"

During Channel attendance:

PRIMARY SOURCE:

GPS → Geofence Engine → Detected Channel

SECONDARY VALIDATION:

User Assignment → Assigned Channel

Example:

Assigned:
CH-07

GPS detected:
CH-07

Result:
VERIFIED

----------------------------------------------------

Assigned:
CH-07

GPS detected:
CH-09

Result:
CHANNEL_MISMATCH

Do NOT silently replace CH-09 with CH-07.

============================================================
15. CHANNEL ATTENDANCE FLOW
============================================================

Implement the following flow.

Worker scans Session QR.

Backend/session determines:

attendance_mode = CHANNEL

Client requests geolocation.

Collect:

latitude
longitude
accuracy
timestamp

Send location to backend.

Backend:

1. Authenticate user
2. Validate session
3. Validate session is active
4. Validate tenant
5. Validate project/site
6. Validate coordinates
7. Validate GPS accuracy
8. Find matching Channel
9. Compare detected Channel with assigned Channel
10. Create attendance
11. Record verification metadata
12. Return result

============================================================
16. GPS LOCATION DATA
============================================================

Attendance should capture:

latitude
longitude
gps_accuracy
location_timestamp

Do not trust client-provided channel_id.

The client may provide coordinates, but the backend must determine the Channel.

Do NOT accept:

{
    channel_id: "CH-07"
}

as the authoritative source.

Instead client sends:

{
    latitude: ...,
    longitude: ...,
    accuracy: ...,
    timestamp: ...
}

Backend determines:

detected_channel_id

============================================================
17. GEOFENCE DETECTION
============================================================

For POINT_RADIUS:

Determine whether:

distance(worker_point, channel_center)
<= channel_radius

For POLYGON:

Determine:

worker_point is inside polygon

Prefer PostGIS:

ST_Contains
ST_Within
ST_DWithin
or equivalent spatial functions.

Do not perform large-scale geofence calculations in browser JavaScript.

============================================================
18. GPS ACCURACY
============================================================

Do not blindly trust GPS coordinates.

If accuracy is poor, handle it gracefully.

Example policy:

Excellent:
< 30m

Acceptable:
30–75m

Warning:
75–150m

Poor:
> 150m

IMPORTANT:

Do not hardcode these values if the project already has configuration infrastructure.

Make GPS accuracy thresholds configurable where appropriate.

At minimum:

If GPS accuracy is too poor to reliably determine a Channel:

Show:

"Your location accuracy is too low. Please move to an open area and try again."

Provide:

[Retry Location]

============================================================
19. CHANNEL MISMATCH
============================================================

If:

assigned_channel_id != detected_channel_id

Do NOT silently mark standard verified attendance.

Return a structured result:

CHANNEL_MISMATCH

Example UI:

----------------------------------------------------
Attendance Could Not Be Verified

Assigned Channel:
CH-07

Detected Channel:
CH-09

Your current location appears to be outside
your assigned work channel.

Please contact your supervisor if you were
reassigned.

[Retry]
[Request Supervisor Review]
----------------------------------------------------

The exact UX should follow the application's existing patterns.

============================================================
20. GPS FAILURE / FALLBACK
============================================================

Do NOT automatically silently use user.channel_id when GPS fails.

Preferred flow:

GPS unavailable
    ↓
Request permission
    ↓
Retry
    ↓
Still unavailable
    ↓
Controlled exception

Possible result:

LOCATION_UNAVAILABLE

Allow supervisor/admin override if the existing system supports overrides.

If business requirements explicitly require assigned-channel fallback, implement it as a configurable policy.

For example:

channel_fallback_policy:

BLOCK
ALLOW_ASSIGNED_CHANNEL

If fallback is used, attendance MUST record:

location_source = ASSIGNED_CHANNEL
verification_status = FALLBACK

Never label it as GPS verified.

============================================================
21. ATTENDANCE RECORD
============================================================

Extend the attendance record to support both Branch and Channel.

Recommended logical fields:

attendance_mode

branch_id

assigned_channel_id

detected_channel_id

latitude

longitude

gps_accuracy

location_source

verification_status

location_timestamp

Adapt names to the existing schema.

For Branch attendance:

attendance_mode = BRANCH

branch_id = actual branch

Channel fields may be NULL.

For Channel attendance:

attendance_mode = CHANNEL

assigned_channel_id = user assignment

detected_channel_id = geofence result

GPS metadata populated.

============================================================
22. LOCATION SOURCE ENUM
============================================================

Recommended:

BRANCH_ASSIGNMENT
GPS_GEOFENCE
ASSIGNED_CHANNEL
ADMIN_OVERRIDE

Use the existing project's enum/type conventions.

============================================================
23. VERIFICATION STATUS
============================================================

Recommended:

VERIFIED
CHANNEL_MISMATCH
LOCATION_UNAVAILABLE
LOW_ACCURACY
FALLBACK
OVERRIDE
REJECTED

Only implement statuses that fit the existing attendance architecture.

Do not create unnecessary duplication.

============================================================
24. CHANNEL ASSIGNMENT HISTORY
============================================================

For V1:

users.channel_id may be sufficient.

However, architect the system so that historical assignment can be introduced.

Preferably support:

user_channel_assignments

id
tenant_id
user_id
channel_id
valid_from
valid_to
assigned_by
reason
created_at

If the existing system already has assignment history patterns, reuse them.

If implementing this now is low-risk, implement it.

Attendance validation should ideally use the assignment active at attendance time.

============================================================
25. MULTI-TENANCY
============================================================

Mealiez is a multi-tenant SaaS.

This feature MUST respect tenant isolation.

Every Channel must belong to the correct tenant.

Every Channel query must be tenant-scoped.

Users can only access Channels belonging to their tenant and authorized project/site.

Attendance geofence lookup must also be tenant/project scoped.

Do not allow cross-tenant Channel detection.

============================================================
26. RLS / SECURITY
============================================================

If using Supabase:

Implement/update RLS policies for:

channels
channel assignments
attendance sessions
attendance records

Follow the existing Mealiez RLS architecture.

Never weaken existing policies.

Do not use service-role credentials in frontend code.

Do not expose privileged Supabase keys.

All authorization decisions must happen server-side.

============================================================
27. DUPLICATE ATTENDANCE
============================================================

Existing duplicate attendance rules must remain intact.

Channel Mode must not create duplicate attendance because of:

- repeated QR scans
- GPS retry
- frontend retry
- network retry

Use the existing attendance uniqueness/idempotency architecture.

If no suitable mechanism exists, implement an idempotent attendance creation strategy.

============================================================
28. OFFLINE / NETWORK FAILURE
============================================================

Handle:

- GPS unavailable
- permission denied
- network unavailable
- backend timeout
- session expired
- session closed
- invalid coordinates
- channel not found
- channel mismatch

Do not show generic:

"Something went wrong."

Return useful messages.

============================================================
29. CHANNEL NOT FOUND
============================================================

If GPS coordinates do not fall within any active Channel:

Show:

"No active work channel was detected at your current location."

Actions:

[Retry Location]

Optionally:

[Contact Supervisor]

Do not assign a random nearest Channel unless the business rules explicitly permit it.

IMPORTANT:

For overlapping geofences, define deterministic behavior.

Prefer rejecting ambiguous detection or applying a configured priority rather than silently choosing an arbitrary Channel.

============================================================
30. ADMIN CHANNEL DETAILS
============================================================

Channel details page/modal should display:

Channel Name
Channel Code
Project/Site
Geometry Type
Coordinates
Radius / Boundary
Status
Assigned Worker Count
Created At
Updated At

Actions:

Edit
Deactivate
View Workers

============================================================
31. WORKER ASSIGNMENT
============================================================

From User Profile:

Channel:
[ CH-07 ▼ ]

When changing Channel:

Require appropriate permissions.

If assignment history exists, create a new assignment record.

Do not modify historical attendance records.

Existing attendance records must preserve the Channel that was relevant when attendance occurred.

============================================================
32. REPORTING
============================================================

Existing attendance reports should continue working.

Add Channel filters where appropriate.

For Channel Mode, support:

Date
Project/Site
Channel
Worker
Status
Verification Status

Example:

Channel:
CH-07

Present:
38

Absent:
4

GPS Verified:
36

Fallback:
2

Mismatch:
1

Do not redesign the entire analytics system unless required.

============================================================
33. UX PRINCIPLES
============================================================

Follow existing Mealiez UI.

The UI should be:

- clean
- professional
- enterprise-oriented
- responsive
- accessible
- mobile-friendly
- consistent with existing Branch Management

Avoid:

- unnecessary animations
- excessive gradients
- excessive cards
- complicated navigation
- duplicate screens

Use existing Mealiez design tokens and components.

============================================================
34. ERROR STATES
============================================================

Implement proper states for:

Loading
Empty
Error
Unauthorized
No Channels
No Project
Invalid KML
Invalid Geometry
GPS Permission Denied
GPS Timeout
GPS Low Accuracy
Channel Not Found
Channel Mismatch
Session Expired
Session Closed
Network Failure

============================================================
35. DATABASE MIGRATION
============================================================

Create proper migration files according to the project's existing migration strategy.

DO NOT manually modify production database without migrations.

Migration must:

- create channel structure
- add required enums/types
- add session attendance_mode
- add channel_id to user/profile if appropriate
- extend attendance records
- add RLS
- add indexes
- add spatial indexes if PostGIS is used

Use appropriate indexes.

For PostGIS geometry:

Use a GiST spatial index where appropriate.

============================================================
36. PERFORMANCE
============================================================

Geofence lookup must be efficient.

Do NOT:

- fetch every Channel to frontend
- perform every geofence calculation in browser
- scan all tenant channels in application memory

Prefer:

Database-side spatial query.

Conceptually:

GPS Point
    ↓
PostGIS
    ↓
tenant/project scoped spatial search
    ↓
matching Channel

============================================================
37. AUDITABILITY
============================================================

Attendance verification should be explainable.

An admin should be able to determine:

Who marked attendance?
Which session?
Assigned Channel?
Detected Channel?
GPS coordinates?
GPS accuracy?
Location source?
Verification result?
Timestamp?
Was there a mismatch?
Was fallback used?
Was there an override?

Do not discard this metadata.

============================================================
38. TESTING
============================================================

Implement tests according to the project's testing architecture.

At minimum test:

CHANNEL CRUD

- create
- update
- delete/deactivate
- duplicate code
- tenant isolation

KML:

- valid KML
- invalid KML
- multiple channels
- invalid geometry
- malformed coordinates

GEOFENCE:

- point inside radius
- point outside radius
- point inside polygon
- point outside polygon
- boundary conditions
- overlapping channels
- inactive channel

ATTENDANCE:

- branch mode still works
- channel mode works
- GPS channel matches assignment
- GPS channel mismatches assignment
- GPS unavailable
- low GPS accuracy
- channel not found
- duplicate scan
- closed session
- unauthorized user

SECURITY:

- cross-tenant channel access
- cross-tenant attendance
- unauthorized channel modification
- unauthorized assignment

============================================================
39. BACKWARD COMPATIBILITY
============================================================

This is a HARD REQUIREMENT.

After implementation:

Existing Branch attendance must continue working without requiring existing customers to configure Channels.

Existing Branch sessions must remain valid.

Existing attendance records must remain valid.

Existing Branch filters/reports must remain valid.

Existing user profiles must remain valid.

Default attendance behavior should remain:

BRANCH

unless explicitly selected otherwise.

============================================================
40. IMPLEMENTATION STRATEGY
============================================================

Work in the following order.

PHASE 1
Codebase audit.

PHASE 2
Database/schema design.

PHASE 3
Channel Management CRUD.

PHASE 4
KML import and validation.

PHASE 5
User Channel assignment.

PHASE 6
Session creation Attendance Mode UI.

PHASE 7
Channel GPS detection service.

PHASE 8
Channel attendance integration.

PHASE 9
Mismatch/fallback handling.

PHASE 10
Attendance dashboard/report integration.

PHASE 11
RLS/security.

PHASE 12
Testing.

PHASE 13
UI/UX polish.

============================================================
41. DO NOT MAKE THESE MISTAKES
============================================================

DO NOT:

1. Replace Branch with Channel.
2. Remove branch_id from existing records.
3. Use user.channel_id as the GPS detection result.
4. Trust client-provided channel_id.
5. Automatically mark attendance using assigned Channel when GPS fails without recording fallback.
6. Break existing Branch attendance.
7. Fetch all Channels to frontend for every attendance scan.
8. Perform geofence calculations entirely in frontend.
9. Import KML directly into production without validation.
10. Hardcode DHD-specific Channel IDs.
11. Hardcode coordinates.
12. Hardcode one specific radius for all Channels.
13. Allow cross-tenant Channel access.
14. Modify historical attendance records when a worker's Channel assignment changes.
15. Create a completely separate UI design system.

============================================================
42. RECOMMENDED ATTENDANCE ARCHITECTURE
============================================================

Implement the concept:

                    ATTENDANCE ENGINE
                           |
                 SESSION ATTENDANCE MODE
                           |
              +------------+------------+
              |                         |
          BRANCH MODE              CHANNEL MODE
              |                         |
        branch_id                 GPS coordinates
                                        |
                                  Geofence Engine
                                        |
                                  detected_channel
                                        |
                              assigned_channel validation
                                        |
                              verification result
                                        |
                              Attendance Record

The Attendance Engine should have clear separation between:

- session validation
- location resolution
- channel detection
- assignment validation
- attendance creation

Do not scatter Channel logic throughout unrelated components.

============================================================
43. RECOMMENDED SERVICE LAYER
============================================================

If the current architecture supports service classes/functions, create a dedicated service concept such as:

channelService

Responsibilities:

- createChannel
- updateChannel
- deactivateChannel
- getChannels
- getChannel
- importKML
- validateGeometry

geofenceService

Responsibilities:

- detectChannel
- validateCoordinates
- validateAccuracy
- resolveGeofence

attendanceService

Responsibilities:

- validateSession
- resolveAttendanceLocation
- validateChannelAssignment
- createAttendance

Use names appropriate to the existing architecture.

============================================================
44. API / BACKEND CONTRACT
============================================================

The frontend should never directly decide the detected Channel.

Conceptual request:

POST /attendance/scan

{
    session_id,
    latitude,
    longitude,
    accuracy,
    location_timestamp
}

Backend response:

SUCCESS:

{
    status: "VERIFIED",
    attendance_id,
    attendance_mode: "CHANNEL",
    detected_channel_id,
    detected_channel_name,
    verification_status: "VERIFIED"
}

Mismatch:

{
    status: "CHANNEL_MISMATCH",
    assigned_channel_id,
    assigned_channel_name,
    detected_channel_id,
    detected_channel_name
}

Location unavailable:

{
    status: "LOCATION_UNAVAILABLE"
}

Low accuracy:

{
    status: "LOW_ACCURACY",
    required_accuracy: ...
}

Adapt this to the existing API architecture rather than blindly introducing REST endpoints if the application uses another pattern.

============================================================
45. MOBILE / BROWSER LOCATION
============================================================

For web:

Use the browser Geolocation API if this is the existing attendance mechanism.

Handle:

permission denied
timeout
unavailable
inaccurate position

Do not request location unnecessarily outside Channel attendance.

Branch attendance should not require GPS unless existing functionality already does.

============================================================
46. SECURITY AGAINST LOCATION MANIPULATION
============================================================

Treat client GPS as untrusted input.

At minimum:

- server-side geofence calculation
- accuracy validation
- timestamp validation
- session validation
- authenticated user validation
- tenant validation
- channel assignment validation
- rate limiting where supported

For future native Android implementation, leave architectural room for:

- mock location detection
- device binding
- Play Integrity
- stronger location attestation

Do not claim browser GPS is tamper-proof.

============================================================
47. ACCEPTANCE CRITERIA
============================================================

The implementation is considered complete only when:

[ ] Existing Branch Management still works.

[ ] Existing Branch attendance still works.

[ ] Start New Session has Branch/Channel attendance location selection.

[ ] Branch mode behaves exactly as before.

[ ] Channel Management exists.

[ ] Admin can create Channel.

[ ] Admin can edit Channel.

[ ] Admin can activate/deactivate Channel.

[ ] Admin can assign Channel to a user.

[ ] User profile contains current channel assignment.

[ ] KML can be imported.

[ ] KML is validated before import.

[ ] Channel geometry is stored correctly.

[ ] Channel map/list exists where appropriate.

[ ] Channel attendance requests GPS.

[ ] Backend determines Channel from coordinates.

[ ] Client cannot dictate detected Channel.

[ ] Assigned Channel is validated against detected Channel.

[ ] Channel mismatch is handled explicitly.

[ ] GPS failure is handled explicitly.

[ ] Low GPS accuracy is handled.

[ ] Channel-not-found is handled.

[ ] Attendance records store sufficient location metadata.

[ ] Existing attendance records remain compatible.

[ ] RLS is correct.

[ ] Tenant isolation is preserved.

[ ] Duplicate attendance is prevented.

[ ] Tests pass.

[ ] TypeScript/build/lint checks pass according to project configuration.

============================================================
48. IMPORTANT DEVELOPMENT PROCESS
============================================================

Do not immediately start writing code.

First inspect the repository.

Identify the exact files/components/tables that need modification.

Then produce a concise implementation plan containing:

1. Current architecture findings
2. Existing attendance flow
3. Existing Branch flow
4. Database changes
5. New Channel module
6. Session UI changes
7. GPS/geofence implementation
8. Security/RLS changes
9. Testing strategy
10. Files that will be modified/created

Then implement.

When implementing:

- make small logical changes
- preserve existing abstractions
- avoid unnecessary refactoring
- reuse components
- maintain TypeScript type safety
- maintain existing coding conventions

After implementation:

Run the project's available:

- typecheck
- lint
- unit tests
- integration tests
- build

Fix all errors caused by your changes.

============================================================
49. FINAL OUTPUT
============================================================

After implementation, provide a concise engineering summary:

### Implemented

- Channel Management
- KML Import
- User Channel Assignment
- Session Attendance Mode
- GPS Channel Detection
- Channel Validation
- Fallback Handling
- Attendance Metadata
- RLS/Security
- Tests

### Database Changes

List exact migrations/tables/columns added.

### Files Changed

List important files.

### Attendance Flow

Explain final Branch Mode and Channel Mode behavior.

### Testing

Report:

- typecheck
- lint
- tests
- build

### Known Limitations

Clearly identify anything not implemented due to existing architecture or missing infrastructure.

============================================================
50. FINAL PRODUCT BEHAVIOR
============================================================

The final system should behave like this:

BRANCH MODE

Admin:
Start Session
→ Branch Based
→ Select Branch
→ Start Session

Worker:
Scan QR
→ Existing attendance flow
→ Attendance recorded against Branch

----------------------------------------------------

CHANNEL MODE

Admin:
Start Session
→ Channel Based
→ Select Project/Site
→ Start Session

Worker:
Scan QR
→ Request GPS
→ Get coordinates
→ Backend geofence detection
→ Detect Channel
→ Compare with assigned Channel
→ Verify
→ Mark Attendance

Example:

Worker:
Rahul

Assigned Channel:
CH-07

GPS:
18.52381, 73.85791

Detected:
CH-07

Result:
✓ Attendance Verified

----------------------------------------------------

MISMATCH

Assigned:
CH-07

Detected:
CH-09

Result:
⚠ Channel Mismatch

Do not silently mark normal verified attendance.

----------------------------------------------------

GPS FAILURE

GPS unavailable

→ Retry

Still unavailable

→ Controlled exception / configured fallback

If fallback is enabled:

location_source = ASSIGNED_CHANNEL
verification_status = FALLBACK

Never pretend it was GPS verified.

============================================================
FINAL INSTRUCTION
============================================================

Build this as a real Mealiez enterprise feature, not a demo.

Prioritize:

1. Backward compatibility
2. Correct attendance semantics
3. Multi-tenant security
4. Server-side geospatial validation
5. Auditability
6. Clean UX
7. Reuse of existing Mealiez architecture
8. Maintainability
9. Performance
10. Future extensibility

DO NOT over-engineer unrelated parts of the application.

DO NOT rewrite existing modules unnecessarily.

DO NOT remove or weaken Branch functionality.

The result should feel like a native extension of the existing Mealiez product and specifically support DHD Infra's Channel-based attendance requirement.