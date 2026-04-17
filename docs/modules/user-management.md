# 📌 Module: User Management

## 🎯 Purpose
To provide organization administrators with a centralized interface for managing member access, assigning functional roles, and controlling the active status of users within the organization. This module ensures that only authorized personnel can access sensitive mess management data and perform specific actions based on their assigned permissions.

## 👤 User Roles
- **Owner**: Full access to all management features, including the ability to transfer ownership or delete the organization profile.
- **Admin**: Can invite new users, update user roles (except Owner), and activate/deactivate members.
- **Manager**: Can view the user list but cannot modify roles or invite new users.
- **Member**: Can view the directory of active members but has no management privileges.

## ⚡ User Actions
- **View User Directory**: Browse a list of all users associated with the organization.
- **Search Users**: Quickly find specific members by name or email.
- **Filter Users**: Narrow down the list by Role or Account Status.
- **Invite User**: Send an invitation to a new member via email.
- **Update Role**: Change the permission level of an existing user (e.g., Member to Manager).
- **Toggle Status**: Deactivate a user to revoke access or reactivate a previously deactivated account.
- **Remove User**: Permanently delete a user from the organization records.

## 🧾 Data Fields
| Field Name | Type | Description |
|------------|------|-------------|
| Full Name | String | The display name of the user. |
| Email | Email | The unique identifier and contact address for the user. |
| Role | Enum | One of: Owner, Admin, Manager, Member. |
| Status | Boolean | Indicates if the user is currently "Active" or "Deactivated". |
| Joined Date | Date | The timestamp of when the user first joined the organization. |

## 📄 Views Required
- **Users Dashboard (List View)**: The primary table showing all users with search and filter controls.
- **Invite User Modal**: A compact form for sending new invitations.
- **User Detail View (Slide-over/Modal)**: A detailed look at a user's activity history and profile information.
- **Role Update Confirmation**: A focused interaction for changing sensitive permission levels.

## 🧩 UI Components
- **Data Table**: Displays user rows with sortable columns.
- **Role Badges**: Color-coded chips to visually distinguish between Owner, Admin, etc.
- **Status Toggles**: Visual indicators (Green/Gray) for Active vs. Deactivated states.
- **Search Input**: Real-time filtering text box.
- **Action Menu (Dropdown)**: Triggered per row to access "Edit Role", "Deactivate", or "Remove".
- **Primary Button**: "Invite User" button clearly positioned at the top of the view.
- **Feedback Toasts**: Success/Error notifications following management actions.

## 🔁 States & Behavior
- **Empty State**: Shown when no users match a search query or when an organization has no members yet (aside from the creator).
- **Loading State**: Skeleton rows or a spinner shown while fetching the user list.
- **Error State**: Clear messaging if the user list fails to load or an action (like inviting) fails.
- **Validation Rules**: 
  - Email must be a valid format.
  - Role selection is mandatory during invitation.
  - Users cannot change their own role to a lower level.
  - Owners cannot be deactivated by other admins.

## 🔍 Filters & Search
- **Text Search**: Matches against `Full Name` and `Email`.
- **Role Filter**: Multi-select or dropdown to show specific roles (e.g., show only "Admins").
- **Status Filter**: Toggle between "All", "Active", and "Deactivated".

## ⚠️ Special Rules
- **Role Hierarchy**: An Admin cannot change the role of an Owner.
- **Self-Protection**: A user cannot deactivate their own account from the management table.
- **Email Uniqueness**: The system must prevent inviting an email that is already a member of the current organization.
- **Minimum Owner Requirement**: An organization must always have at least one active Owner.

## 🔗 Dependencies
- **Auth Module**: Requires valid session data to determine the current user's management permissions.
- **Onboarding Module**: The "Invite User" flow triggers the external onboarding process for the invited party.

## 🧪 QA Test Scenarios
- **Functionality**:
    - Verify that an Admin can successfully invite a new user.
    - Verify that a user's role is updated immediately in the UI after a change.
    - Ensure a deactivated user is blocked from logging in (verified via session test).
- **Edge Cases**:
    - Attempt to invite an email that is already in the list.
    - Attempt to remove the last remaining Owner (should be blocked).
    - Search for a user with special characters in their name.
- **Failure Scenarios**:
    - Attempting to update a role while the internet connection is lost.
    - Unauthorized "Member" role attempting to access the "Invite" API endpoint.
    - Submitting the invite form with an invalid email format.
