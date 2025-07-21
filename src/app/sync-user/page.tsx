import React, { Suspense } from 'react';
import { db } from '@/server/db';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';

function Loader() {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
            <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
                <p className="mt-4 text-gray-600 text-lg">Syncing user data...</p>
            </div>
        </div>
    );
}

const SyncUserContent = async () => {
    const { userId } = await auth();

    if (!userId) {
        throw new Error("User not found");
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
        return notFound();
    }

    await db.user.upsert({
        where: { emailAddress: email },
        update: {
            imageUrl: user.imageUrl,
            firstName: user.firstName,
            lastName: user.lastName,
        },
        create: {
            id: userId,
            emailAddress: email,
            imageUrl: user.imageUrl,
            firstName: user.firstName,
            lastName: user.lastName,
        },
    });

    redirect('/dashboard');
    return null;
};

export default function SyncUser() {
    return (
        <Suspense fallback={<Loader />}>
            <SyncUserContent />
        </Suspense>
    );
}
