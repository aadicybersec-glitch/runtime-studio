import { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import { compare } from 'bcryptjs'
import prisma from '@/lib/prisma'

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await compare(credentials.password, user.password)

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
        }
      },
    }),

    // Resilient OAuth Ingest: Only mount providers if keys are defined in dashboard
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GithubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),

    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  session: {
    strategy: 'jwt',
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // On initial credentials sign-in, user object is populated with DB id
      if (user && account?.provider === 'credentials') {
        token.sub = user.id;
      }

      // On OAuth sign-in, look up or create the user in our database by email
      if (account && account.provider !== 'credentials' && token.email) {
        try {
          let dbUser = await prisma.user.findUnique({
            where: { email: token.email },
          });

          if (!dbUser) {
            // First time OAuth sign-in — create a database user record
            dbUser = await prisma.user.create({
              data: {
                email: token.email,
                name: token.name ?? null,
                image: token.picture ?? null,
                password: '', // OAuth users have no password
              },
            });
          }

          token.sub = dbUser.id;
        } catch (err) {
          console.error('[NextAuth] Failed to sync OAuth user to database:', err);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
}
