import { NextRequest, NextResponse } from "next/server";
import { 
  getCompanyUsers, 
  createCompanyUser, 
  deleteCompanyUser, 
  setUserPermissions, 
  getUserPermissions,
  updateCompanyUser
} from "@/lib/dbUsers";
import { getCompanySessionId, getSessionRole } from "@/lib/companyAuth";
import { isAdminLoggedIn } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const companyId = await getCompanySessionId();
    const adminLoggedIn = await isAdminLoggedIn();
    
    // Support admin viewing company users via query param
    const { searchParams } = new URL(req.url);
    const targetCompanyId = adminLoggedIn ? searchParams.get("companyId") || companyId : companyId;

    if (!targetCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await getCompanyUsers(targetCompanyId);
    
    // Also fetch permissions for each user
    const usersWithPerms = await Promise.all(users.map(async (u: any) => {
      const permissions = await getUserPermissions(u.id);
      return { ...u, permissions };
    }));

    return NextResponse.json({ users: usersWithPerms });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const role = await getSessionRole();
    const adminLoggedIn = await isAdminLoggedIn();
    
    if (role !== "company" && !adminLoggedIn) {
      return NextResponse.json({ error: "Only admins or company owners can manage users" }, { status: 403 });
    }

    const body = await req.json();
    const { username, password, fullName, companyId, permissions } = body;

    if (!username || !password || !companyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userId = await createCompanyUser({
      companyId,
      username,
      passwordRaw: password,
      fullName: fullName || ""
    });

    if (permissions && Array.isArray(permissions)) {
      await setUserPermissions(userId, permissions);
    }

    return NextResponse.json({ ok: true, userId });
  } catch (error: any) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const role = await getSessionRole();
    const adminLoggedIn = await isAdminLoggedIn();
    
    if (role !== "company" && !adminLoggedIn) {
       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await deleteCompanyUser(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const role = await getSessionRole();
    const adminLoggedIn = await isAdminLoggedIn();
    
    if (role !== "company" && !adminLoggedIn) {
       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, userId, fullName, password, permissions } = body;
    const targetId = id || userId;

    if (!targetId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Update user details if provided
    await updateCompanyUser(targetId, { fullName, passwordRaw: password });

    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      await setUserPermissions(targetId, permissions);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
