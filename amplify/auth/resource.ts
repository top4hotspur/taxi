import { defineAuth } from "@aws-amplify/backend";

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ["admin", "customer", "driver"],
});

// TODO: Production group assignment should be automated via post-confirmation triggers
// or a secure admin management flow. Do not rely on manual console assignment long-term.
