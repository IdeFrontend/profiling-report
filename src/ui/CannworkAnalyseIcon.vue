<template>
  <!-- Multi-colour "CANNWork analyse" mark (cannwork-analyse.svg): purple gradient
       agent body, white sensor bars, sparkle. Gradient ids carry a component prefix:
       several instances render on one page and bare ids would cross-reference. -->
  <svg
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        id="cannwork-analyse-body"
        x1="4.1337"
        y1="6.2698"
        x2="7.1725"
        y2="13.049"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#9169d6" />
        <stop
          offset="1"
          stop-color="#632dbe"
        />
      </linearGradient>
      <linearGradient
        id="cannwork-analyse-edge"
        x1="6.4713"
        y1="8.6075"
        x2="13.4838"
        y2="15.62"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          stop-color="#ffffff"
          stop-opacity="0"
        />
        <stop
          offset="1"
          stop-color="#813afb"
        />
      </linearGradient>
      <linearGradient
        id="cannwork-analyse-spark"
        x1="15.6281"
        y1="-0.6368"
        x2="15.6281"
        y2="10.107"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          stop-color="#cdb0ff"
          stop-opacity="0"
        />
        <stop
          offset="0.3095"
          stop-color="#7d40ff"
          stop-opacity="0.3098"
        />
        <stop
          offset="1"
          stop-color="#7d40ff"
        />
      </linearGradient>
    </defs>
    <rect
      x="2.3223"
      y="3.9913"
      width="11.5702"
      height="11.5702"
      rx="2.6446"
      fill="url(#cannwork-analyse-body)"
    />
    <rect
      x="2.4876"
      y="4.1566"
      width="11.2397"
      height="11.2397"
      rx="2.4793"
      fill="none"
      stroke="url(#cannwork-analyse-edge)"
      stroke-width="0.3306"
    />
    <rect
      x="4.442"
      y="7.9582"
      width="1.8474"
      height="4.6488"
      rx="0.8264"
      fill="#fefeff"
    />
    <rect
      x="9.07"
      y="7.9582"
      width="1.8474"
      height="4.6488"
      rx="0.8264"
      fill="#fefeff"
    />
    <path
      d="M15.097 0.731755C15.2811 0.257294 15.9551 0.264834 16.1285 0.743296L16.9367 2.97203C16.9908 3.12123 17.1066 3.23986 17.2545 3.29752L19.6602 4.23578C20.1309 4.41936 20.1269 5.08684 19.654 5.26475L17.2595 6.16568C17.1087 6.22243 16.9902 6.34236 16.9354 6.4939L16.1287 8.72356C15.9554 9.2025 15.2807 9.21004 15.0968 8.73509L14.2244 6.48243C14.1683 6.33765 14.0537 6.22324 13.9089 6.16737L11.5649 5.26315C11.0978 5.08295 11.0937 4.42344 11.5586 4.23753L13.9139 3.29572C14.0558 3.239 14.1677 3.12592 14.223 2.9835L15.097 0.731755Z"
      fill="url(#cannwork-analyse-spark)"
      fill-rule="evenodd"
    />
    <path
      d="M15.097 0.731755C15.2811 0.257294 15.9551 0.264834 16.1285 0.743296L16.9367 2.97203C16.9908 3.12123 17.1066 3.23986 17.2545 3.29752L19.6602 4.23578C19.8943 4.32707 20.011 4.53804 20.011 4.74896C20.011 4.96216 19.8917 5.17532 19.654 5.26475L17.2595 6.16568C17.1087 6.22243 16.9902 6.34236 16.9354 6.4939L16.1287 8.72356C15.9554 9.2025 15.2807 9.21004 15.0968 8.73509L14.2244 6.48243C14.1683 6.33765 14.0537 6.22324 13.9089 6.16737L11.5649 5.26315C11.33 5.17255 11.2122 4.9608 11.2122 4.74899C11.2122 4.53951 11.3275 4.32997 11.5586 4.23753L13.9139 3.29572C14.0558 3.239 14.1677 3.12592 14.223 2.9835L15.097 0.731755ZM14.3463 3.03134C14.2746 3.21593 14.1469 3.34498 13.963 3.4185L11.6077 4.36031C11.4322 4.43049 11.3445 4.5597 11.3445 4.74795L11.3445 4.75167C11.3456 4.94194 11.435 5.07131 11.6125 5.13978L13.9565 6.044Q14.0975 6.09839 14.1953 6.19606Q14.2931 6.29373 14.3477 6.43467L15.2201 8.68733C15.29 8.86781 15.4217 8.95697 15.6153 8.95481Q15.7604 8.95319 15.8577 8.88413Q15.9549 8.81507 16.0043 8.67857L16.8111 6.44891C16.8825 6.2515 17.0164 6.11584 17.2129 6.04192L19.6074 5.14099Q19.7422 5.09029 19.81 4.99294Q19.8779 4.89558 19.8787 4.7516L19.8787 4.74792Q19.8787 4.60635 19.8129 4.50945Q19.7463 4.41129 19.6121 4.35897L17.2064 3.42072Q17.0622 3.36446 16.9637 3.26356Q16.8651 3.16266 16.8124 3.01711L16.0042 0.788371Q15.9548 0.652009 15.8576 0.583017Q15.7603 0.514025 15.6153 0.512403Q15.4702 0.51078 15.3715 0.577579Q15.2727 0.644378 15.2202 0.7796L14.3463 3.03134Z"
      fill="#ffffff"
      fill-rule="evenodd"
    />
  </svg>
</template>

<style scoped>
svg {
  width: 20px;
  height: 20px;
  display: block;
}
</style>
