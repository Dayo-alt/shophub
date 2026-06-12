**SHOPHUB**

ShopHub is an open-source, AI-driven E-Commerce Management System designed for multi-seller marketplaces. Built with React, TypeScript, Tailwind CSS, and Supabase, ShopHub empowers buyers, sellers, and administrators with intelligent inventory control, smart cart retention, and real-time order management.

**Why ShopHub is Open Source?**

We believe that small businesses and indie developers should have access to modern e-commerce infrastructure without massive enterprise costs. ShopHub is open-sourced under the MIT License to empower the global developer community to self-host, customize, and build upon a scalable marketplace framework.


**Tech Stack**

Frontend Framework: React with Vite
Programming Language: TypeScript
Styling UI: Tailwind CSS
Database & Authentication: Supabase (PostgreSQL)
State Management & Persistence: React Context / LocalStorage
Payment Processing: Paystack/ Stripe (not configured)


**Key Architectural Features**

AI-Driven Cart Retention: Intelligent exit-intent detection and dynamic cart abandonment recovery powered by multi-channel notifications (Email, SMS, WhatsApp).
Smart Inventory Monitoring: Real-time stock synchronization across buyer, seller, and admin dashboards via Supabase real-time subscriptions.
Multi-Role Platform: Seamless buyer, seller, and admin interfaces with role-based access control and comprehensive dashboards.
Order & Fulfillment Management: End-to-end order tracking, returns processing, and seller analytics.
Global Reach: Built-in multi-language support for international markets.

**Local Installation and Configuration Guide**

To set up and run the ShopHub application locally on your machine, follow these step-by-step technical procedures:

1. **Clone the Repository**
Begin by downloading the project source code from the remote repository. Open your terminal or command prompt, execute the Git clone command targeting the repository URL, and then navigate into the root directory of the project:
  
git clone https://github.com/Dayo-alt/shophub.git
cd shophub

2. **Install Project Dependencies**  
Once inside the project root directory, install all the required node packages and project dependencies specified in the configuration files by running the Node Package Manager (npm) installation command:
   ```bash
   npm install

3. **Configure Environment Variables**
The application requires key database configurations to communicate with the backend services. Create a new file named .env.local in the root directory of the project. Open the file and supply your specific database credentials by assigning the proper keys to the following variables:

VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
VITE_STRIPE_PUBLIC_KEY=your_stripe_public_key

4. **Execute the Development Server**
With the dependencies installed and database environment keys successfully configured, initialize the local development server by running:
  ```bash
  npm run dev
```
Once the build compiles successfully, open your web browser and navigate to `http://localhost:5173` to view, test, and interact with the live application interface.
