import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Github, Video, MessageSquare, FileText, ChevronRight, GitBranch, Key, MessageCircleQuestion, Rocket
} from 'lucide-react';
import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <nav className="bg-white border-b border border-blue-100 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Image src="/logo.png" alt="logo" width={60} height={60} className="rounded-xl" />
            </div>
            <h1 className="text-xl font-bold text-blue-800">RepoGPT</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Link href={"/sign-in"}>
                Sign In
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold text-blue-900 mb-6">
          Understand Your Codebase <br />
          <span className="text-blue-600">with AI-Powered Insights</span>
        </h1>
        <p className="text-xl text-blue-800 max-w-3xl mx-auto mb-10">
          RepoGPT analyzes your GitHub repositories and meeting videos, providing
          intelligent summaries and answering your questions about the code.
        </p>
        <div className="flex justify-center space-x-4">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg">
            <Link href={"/sign-in"}>
              Get Started
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 text-lg">
            <a href="#working">
              Learn More
              </a>
          </Button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-blue-900 mb-12">
          Powerful Features for Developers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Github className="text-blue-600" size={24} />
              </div>
              <CardTitle className="text-blue-800">GitHub Analysis</CardTitle>
              <CardDescription>
                Get intelligent summaries of your commits and ask questions about
                your codebase.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Video className="text-blue-600" size={24} />
              </div>
              <CardTitle className="text-blue-800">Meeting Summaries</CardTitle>
              <CardDescription>
                Upload meeting videos and get concise summaries of the
                discussions.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <MessageSquare className="text-blue-600" size={24} />
              </div>
              <CardTitle className="text-blue-800">AI Chat</CardTitle>
              <CardDescription>
                Ask questions about your code and get instant, accurate answers.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section id="working" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-blue-900 mb-12">
          How RepoGPT Works
        </h2>
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-800 text-2xl font-bold">1</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-blue-800 mb-2">Enter Project Details</h3>
              <p className="text-blue-700">
                Start by providing your project name and GitHub repository URL.
                For private repositories, you'll need to add a GitHub access token.
              </p>
              <div className="mt-4 space-y-3 max-w-md">
                <Input placeholder="Project Name" className="border-blue-200" />
                <Input placeholder="GitHub Repository URL" className="border-blue-200" />
                <Input placeholder="GitHub Token (optional for private repos)" className="border-blue-200" />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-800 text-2xl font-bold">2</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-blue-800 mb-2">Create Project</h3>
              <p className="text-blue-700">
                Click the "Create Project" button to let RepoGPT analyze your repository.
                We'll process your codebase and prepare it for questioning.
              </p>
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                Create Project <ChevronRight className="ml-2" size={18} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-800 text-2xl font-bold">3</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-blue-800 mb-2">Start Asking Questions</h3>
              <p className="text-blue-700">
                Once your project is ready, you can ask any questions about your codebase,
                get commit summaries, or upload meeting videos for analysis.
              </p>
              <div className="mt-4 bg-white p-4 rounded-lg border border-blue-200 max-w-lg">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <MessageCircleQuestion className="text-blue-600" size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-blue-800">Example questions:</div>
                    <div className="text-sm text-blue-600 mt-1 space-y-1">
                      <div>• What's the purpose of the auth module?</div>
                      <div>• How do I change the Home page?</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="bg-white rounded-xl shadow-sm p-8 md:p-12">
          <h2 className="text-3xl font-bold text-blue-900 mb-6">
            Ready to Understand Your Codebase Better?
          </h2>
          <p className="text-xl text-blue-800 max-w-2xl mx-auto mb-8">
            Join hundreds of developers using RepoGPT to save time and gain insights.
          </p>
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8">
            <Link href={"/sign-in"}>
            Get Started for Free
            </Link>
          </Button>
        </div>
      </section>

      <footer className="bg-blue-900 text-white py-2">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-6 md:mb-0">
              <div className="">
                © 2025 RepoGPT. All rights reserved.
              </div>
            </div>
            <div className="flex space-x-2">
              <Image src="/logo.png" alt="logo" width={30} height={30} className="rounded-xl" />
              <h3 className="text-lg font-semibold">RepoGPT</h3>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}