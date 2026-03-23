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
      </div>
    </div>
  );
}
