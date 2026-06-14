import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     *  - _next internals
     *  - the /auth/* code-exchange route (must reach Supabase without a gate)
     *  - common static asset extensions
     */
    "/((?!_next/static|_next/image|auth|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
