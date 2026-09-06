import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Attachment } from "./Attachment.vue"
export { default as AttachmentAction } from "./AttachmentAction.vue"
export { default as AttachmentActions } from "./AttachmentActions.vue"
export { default as AttachmentContent } from "./AttachmentContent.vue"
export { default as AttachmentDescription } from "./AttachmentDescription.vue"
export { default as AttachmentGroup } from "./AttachmentGroup.vue"
export { default as AttachmentMedia } from "./AttachmentMedia.vue"
export { default as AttachmentTitle } from "./AttachmentTitle.vue"
export { default as AttachmentTrigger } from "./AttachmentTrigger.vue"

export const attachmentVariants = cva(
  'group/attachment relative flex w-fit max-w-full min-w-0 shrink-0 flex-wrap rounded-xl border border-slate-200 bg-white text-slate-800 transition-colors focus-within:ring-1 focus-within:ring-accent/30 has-[>a,>button]:hover:bg-slate-50 data-[state=error]:border-red-300 data-[state=idle]:border-dashed dark:border-slate-700 dark:bg-[#151c2c] dark:text-slate-100 dark:has-[>a,>button]:hover:bg-white/5',
  {
    variants: {
      size: {
        default: 'gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2',
        sm: 'gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5',
        xs: 'gap-1.5 rounded-lg text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1',
      },
      orientation: {
        horizontal: 'min-w-40 items-center',
        vertical: 'w-24 flex-col has-data-[slot=attachment-content]:w-30',
      },
    },
  },
)

export type AttachmentVariants = VariantProps<typeof attachmentVariants>

export const attachmentMediaVariants = cva(
  'relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-700 [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 group-data-[orientation=vertical]/attachment:w-full group-data-[orientation=vertical]/attachment:[&_svg:not([class*=\'size-\'])]:size-6 group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[size=xs]/attachment:rounded-md group-data-[size=xs]/attachment:[&_svg:not([class*=\'size-\'])]:size-3.5 group-data-[state=error]/attachment:bg-red-50 group-data-[state=error]/attachment:text-red-600 dark:bg-slate-800 dark:text-slate-200 dark:group-data-[state=error]/attachment:bg-red-950/40',
  {
    variants: {
      variant: {
        icon: '',
        image:
          'opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover',
      },
    },
    defaultVariants: {
      variant: 'icon',
    },
  },
)

export type AttachmentMediaVariants = VariantProps<typeof attachmentMediaVariants>
