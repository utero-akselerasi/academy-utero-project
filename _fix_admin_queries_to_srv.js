const fs = require("fs");
const file = "features/admin/queries.ts";
let content = fs.readFileSync(file, "utf8");

// Change import
content = content.replace(
  'import { createUteroAcademyClient } from "@/lib/supabase/server";',
  'import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";'
);

// Change occurrences
content = content.split("createUteroAcademyClient()").join("createUteroAcademyServiceRoleClient()");

fs.writeFileSync(file, content, "utf8");
console.log("Admin queries updated to use service role client!");