// Small circular controls that sit on product photos: Share, Expand, Download
// (DESIGN.md icon-button-circle). The visible circle is 28px on phones and 32px from
// tablet width, kept light so the photo stays in view; an invisible ::after extends the
// tap area to 40px.
export const photoButtonClass =
  "mbi-press relative grid place-items-center size-7 sm:size-8 rounded-full bg-white/85 backdrop-blur-sm ring-1 ring-black/5 text-mbi-navy hover:bg-white after:absolute after:-inset-1.5 sm:after:-inset-1 after:content-['']";

// Icon sizing for the SVG inside a photo button.
export const photoIconClass = "size-[13px] sm:size-3.5";
