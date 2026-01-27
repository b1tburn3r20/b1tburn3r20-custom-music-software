"use client";
import Lottie from "lottie-react";
import animationData from "../../../public/animations/soundbars-light.json";

const LottieViewer = () => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};

export default LottieViewer;
