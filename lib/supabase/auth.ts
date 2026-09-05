import { supabase } from './client';
import { DatabaseProfile, DatabaseWorkspace, DatabaseWorkspaceMember } from './types';
import { UserProfile } from '@/types/finance';

export interface AuthSessionUser {
  id: string;
  email: string;
  profile: UserProfile | null;
  workspaces: DatabaseWorkspace[];
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign up a new user and create their initial profile
 */
export async function signUp(email: string, password: string, fullName: string, jobTitle: string = 'Founder') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        job_title: jobTitle,
      },
    },
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  if (user) {
    // Upsert user profile in profiles table
    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName || 'Founder',
        email: email,
        job_title: jobTitle,
        updated_at: new Date().toISOString(),
      });
    } catch (profErr) {
      console.warn('Profile creation note:', profErr);
    }
  }

  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Get current authenticated session and user details
 */
export async function getCurrentAuthUser(): Promise<AuthSessionUser | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return null;
    }

    const user = session.user;

    // Fetch user profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .limit(1)
      .single();

    const dbProfile = profileData as DatabaseProfile | null;

    // Fetch workspaces the user belongs to
    const { data: members } = await supabase
      .from('workspace_members')
      .select('*, workspaces(*)')
      .eq('user_id', user.id);

    const workspaces: DatabaseWorkspace[] = [];
    if (members && members.length > 0) {
      for (const m of members as (DatabaseWorkspaceMember & { workspaces: DatabaseWorkspace | null })[]) {
        if (m.workspaces) {
          workspaces.push(m.workspaces);
        }
      }
    }

    const profile: UserProfile = {
      id: user.id,
      full_name: dbProfile?.full_name || user.user_metadata?.full_name || 'Founder',
      email: user.email || '',
      avatar_url: dbProfile?.avatar_url || undefined,
      role: 'owner',
    };

    return {
      id: user.id,
      email: user.email || '',
      profile,
      workspaces,
    };
  } catch (err) {
    console.error('Error getting current auth user:', err);
    return null;
  }
}

/**
 * Create a new workspace and add creator as owner
 */
export async function createNewWorkspace(
  userId: string,
  name: string,
  currency: string = 'USD',
  startingCash: number = 500000,
  alertRunwayThreshold: number = 6
): Promise<DatabaseWorkspace | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const effectiveUserId = session?.user?.id || userId;

    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: effectiveUserId,
        name,
        currency,
        startingCash,
        alertRunwayThreshold,
      }),
    });

    const data = await res.json().catch(() => ({ success: false, error: 'Server returned an invalid response' }));

    if (!res.ok || !data.success) {
      throw new Error(data.error || `Server error (${res.status}): Failed to create workspace`);
    }

    return data.workspace as DatabaseWorkspace;
  } catch (err) {
    console.error('Exception creating new workspace:', err);
    throw err;
  }
}
