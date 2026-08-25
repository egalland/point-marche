import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  return Response.json({
    user,
    signInPath: chatGPTSignInPath("/?mode=edit"),
    signOutPath: chatGPTSignOutPath("/"),
  });
}
