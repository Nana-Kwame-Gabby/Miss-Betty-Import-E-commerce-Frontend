import logo from "../assets/logo.png";

export default function SignUp() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
      <div className=" bg-white rounded-lg shadow-lg size-150 flex justify-center items-center flex-col pb-10 ">
        <style>{`
                .spin-vertical{
                animation: spinY 5s linear infinite;
                transform-style: preserve-3d;
                will-change: transform;
                }
                @keyframes spinY {
                from { transform: rotateY(0deg); }
                to   { transform: rotateY(360deg); }
                }
            `}</style>
        <div>
          <img
            src={logo}
            alt="Miss Betty Import Logo"
            className="h-20 mx-auto spin-vertical"
          />
        </div>
        <div className="text-center mb-10 ">
          <p className="text-l font-medium">Create account</p>
        </div>

        <div className="border-b p-1 mb-2 w-sm h-10">
          <input
            type="text"
            id="First Name"
            placeholder="First Name"
            className=" outline-none w-sm p-1"
          />
        </div>
        <div className="border-b p-1 mb-2 w-sm h-10">
          <input
            type="text"
            id="Last Name"
            placeholder="Last Name"
            className=" outline-none w-sm p-1"
          />
        </div>
        <div className="border-b p-1 mb-2 w-sm h-10">
          <input
            type="text"
            id="Email"
            placeholder="Email"
            className=" outline-none w-sm p-1"
          />
        </div>
        <div className="border-b p-1 mb-2 w-sm h-10">
          <input
            type="text"
            id="Phone Number"
            placeholder="Phone Number"
            className=" outline-none w-sm p-1"
          />
        </div>
        <div className="border-b p-1 mb-2 w-sm h-10">
          <input
            type="Password"
            id="Password"
            placeholder="Password"
            className=" outline-none w-sm p-1"
          />
        </div>
        <div className="border-b p-1 mb-2 w-sm h-10">
          <input
            type="Password"
            id="Confirm Password"
            placeholder="Confirm Password"
            className=" outline-none w-sm p-1"
          />
        </div>
        <button className="bg-yellow-500 font-semibold text-white p-2 rounded-sm mt-8 w-40">
          Create Account
        </button>
      </div>
    </div>
  );
}
