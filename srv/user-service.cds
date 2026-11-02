service UserService @(path: '/user', requires: 'authenticated-user') {
  /** Who is signed in and which roles they hold, as a JSON string. The UI uses it to choose what to show; each service still checks roles itself. */
  function me() returns LargeString;
}
