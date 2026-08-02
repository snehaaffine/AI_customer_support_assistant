import ChatWidget from "./components/ChatWidget.js";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-brand-50 to-gray-100">
      {/* Demo storefront backdrop */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="font-playfair text-3xl font-bold text-gray-900 mb-2">
            Welcome to Our Store
          </h1>
          <p className="text-gray-500">
            Browse our collection — need help? Chat with us using the widget
            below.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {["Classic Tee", "Denim Jacket", "Running Shoes"].map((name) => (
            <div
              key={name}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center"
            >
              <div className="w-full aspect-square bg-gray-100 rounded-lg mb-4 flex items-center justify-center text-4xl">
                🛍️
              </div>
              <h3 className="font-medium text-gray-900">{name}</h3>
              <p className="text-sm text-gray-500 mt-1">$49.99</p>
            </div>
          ))}
        </div>
      </div>

      <ChatWidget />
    </div>
  );
}
