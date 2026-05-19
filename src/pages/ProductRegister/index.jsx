import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { useDropzone } from 'react-dropzone'
import {
  Bold, Italic, Heading2, List, ListOrdered,
  ImageIcon, LinkIcon, Upload, X, PenSquare, Loader2
} from 'lucide-react'
import { usePass } from '../../hooks/usePass'
import { productApi } from '../../api'
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../../constants'
import AuthRequiredModal from '../../components/modals/AuthRequiredModal'
import toast from 'react-hot-toast'

const fileIcon = (name = '') => {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📄'
  if (['png', 'jpg', 'jpeg'].includes(ext)) return '🖼️'
  if (ext === 'mp4') return '🎬'
  if (ext === 'zip') return '📦'
  if (ext === 'txt') return '📝'
  return '📁'
}

function EditorToolbar({ editor }) {
  if (!editor) return null
  const btn = (action, icon, title) => (
    <button
      type="button"
      onClick={action}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        editor.isActive(title?.toLowerCase() ?? '')
          ? 'bg-primary text-white'
          : 'text-gray-500 hover:bg-surface hover:text-gray-900'
      }`}
    >
      {icon}
    </button>
  )

  return (
    <div className="flex gap-1 flex-wrap p-2 border-b border-surface-border bg-surface/50">
      {btn(() => editor.chain().focus().toggleBold().run(), <Bold size={16} />, 'Bold')}
      {btn(() => editor.chain().focus().toggleItalic().run(), <Italic size={16} />, 'Italic')}
      {btn(
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        <Heading2 size={16} />,
        'H2'
      )}
      {btn(() => editor.chain().focus().toggleBulletList().run(), <List size={16} />, 'BulletList')}
      {btn(
        () => editor.chain().focus().toggleOrderedList().run(),
        <ListOrdered size={16} />,
        'OrderedList'
      )}
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('이미지 URL 입력')
          if (url) editor.chain().focus().setImage({ src: url }).run()
        }}
        className="p-2 rounded-lg text-gray-500 hover:bg-surface hover:text-gray-900 transition-colors"
        title="이미지"
      >
        <ImageIcon size={16} />
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('링크 URL 입력')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
        className="p-2 rounded-lg text-gray-500 hover:bg-surface hover:text-gray-900 transition-colors"
        title="링크"
      >
        <LinkIcon size={16} />
      </button>
    </div>
  )
}

function FileDropzone({ file, onDrop, onRemove }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => onDrop(files[0]),
    accept: ALLOWED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0]
      if (err?.code === 'file-too-large') toast.error('파일 크기는 500MB 이하이어야 합니다.')
      else toast.error('지원하지 않는 파일 형식입니다. (PDF, PNG, JPG, MP4, ZIP, TXT)')
    },
  })

  return (
    <div>
      {!file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-surface-border hover:border-gray-500 text-gray-500'
          }`}
        >
          <input {...getInputProps()} />
          <Upload size={32} className="mx-auto mb-3" />
          <p className="font-medium mb-1">파일을 드래그하거나 클릭하여 업로드</p>
          <p className="text-sm">PDF, PNG, JPG, MP4, ZIP, TXT · 최대 500MB</p>
        </div>
      ) : (
        <div className="flex items-center gap-4 border border-surface-border rounded-xl p-4 bg-surface">
          <span className="text-3xl">{fileIcon(file.name)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 font-medium truncate">{file.name}</p>
            <p className="text-sm text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-surface-border text-gray-500 hover:text-red-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function ProductRegister() {
  const navigate = useNavigate()
  const { isPassVerified } = usePass()

  const [title, setTitle] = useState('')
  const [priceRp, setPriceRp] = useState('')
  const [mainFile, setMainFile] = useState(null)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit, Image, Link.configure({ openOnClick: false })],
    content: '',
    editorProps: {
      attributes: { class: 'tiptap-editor p-4 focus:outline-none' },
    },
  })

  const handleThumbnailDrop = useCallback(([file]) => {
    if (!file) return
    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
  }, [])

  const { getRootProps: getThumbProps, getInputProps: getThumbInput } = useDropzone({
    onDrop: handleThumbnailDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxSize: 5 * 1024 * 1024,
    maxFiles: 1,
  })

  const validate = () => {
    if (!isPassVerified) { setShowAuthModal(true); return false }
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return false }
    if (!editor?.getText().trim()) { toast.error('상품 설명을 입력해주세요.'); return false }
    if (!mainFile) { toast.error('판매할 파일을 업로드해주세요.'); return false }
    const rp = parseInt(priceRp)
    if (!rp || rp <= 0) { toast.error('판매 금액을 입력해주세요.'); return false }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setUploading(true)

    try {
      const uploadToast = toast.loading('파일 업로드 중... (바이러스 검사 포함)')
      const formData = new FormData()
      formData.append('file', mainFile)
      if (thumbnailFile) formData.append('thumbnail', thumbnailFile)

      const { data: uploadData } = await productApi.uploadFile(formData)
      toast.dismiss(uploadToast)
      toast.success('파일 업로드 완료.')

      const { data: product } = await productApi.create({
        title: title.trim(),
        description: editor.getHTML(),
        priceRp: parseInt(priceRp),
        fileKey: uploadData.fileKey,
        thumbnailUrl: uploadData.thumbnailUrl,
      })

      toast.success('상품이 등록되었습니다!')
      navigate(`/products/${product.id}`)
    } catch {
      // api 인터셉터 처리
    } finally {
      setUploading(false)
    }
  }

  if (!isPassVerified) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-xl font-bold text-gray-900 mb-2">PASS 본인인증이 필요합니다</p>
        <p className="text-gray-500">GNB에서 PASS 인증을 먼저 진행한 후 상품을 등록해주세요.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <PenSquare size={24} className="text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">상품 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 제목 */}
        <div>
          <label className="label">상품 제목 *</label>
          <input
            className="input"
            placeholder="ex) GPT-4o 마케팅 카피 작성 완전 정복 족보"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            required
          />
        </div>

        {/* 상품 설명 */}
        <div>
          <label className="label">상품 설명 *</label>
          <div className="border border-surface-border rounded-xl overflow-hidden bg-surface">
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} className="min-h-[240px] text-gray-900" />
          </div>
        </div>

        {/* 썸네일 */}
        <div>
          <label className="label">썸네일 이미지</label>
          <div className="flex items-start gap-4">
            <div
              {...getThumbProps()}
              className="w-32 h-32 border-2 border-dashed border-surface-border rounded-xl flex items-center justify-center cursor-pointer hover:border-gray-500 transition-colors shrink-0 overflow-hidden"
            >
              <input {...getThumbInput()} />
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-gray-600">
                  <ImageIcon size={24} className="mx-auto mb-1" />
                  <p className="text-xs">클릭/드래그</p>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500 pt-2">
              <p>• PNG, JPG, WEBP 권장</p>
              <p>• 최대 5MB</p>
              <p>• 없으면 파일 형식 아이콘으로 표시</p>
            </div>
          </div>
        </div>

        {/* 원본 파일 업로드 */}
        <div>
          <label className="label">판매 파일 * (최대 500MB)</label>
          <FileDropzone
            file={mainFile}
            onDrop={setMainFile}
            onRemove={() => setMainFile(null)}
          />
          <p className="text-xs text-gray-600 mt-2">
            PDF, PNG, JPG, MP4, ZIP, TXT 지원 · AWS Lambda + ClamAV 바이러스 자동 검사
          </p>
        </div>

        {/* 판매 금액 */}
        <div>
          <label className="label">판매 금액 (RP) *</label>
          <div className="relative">
            <input
              type="number"
              className="input pr-16"
              placeholder="ex) 1000"
              step="1"
              min="1"
              value={priceRp}
              onChange={(e) => setPriceRp(e.target.value)}
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
              RP
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1.5">
            플랫폼 수수료 10% 차감 후 정산됩니다. 구매자는 RP 또는 Toss 직접 결제로 구매할 수 있습니다.
          </p>
        </div>

        {/* 등록 안내 */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-primary mb-2">등록 안내</p>
          <div className="text-sm text-gray-400 space-y-1">
            <p>① 등록 버튼 클릭 → 파일 S3 업로드 + 바이러스 검사</p>
            <p>② 검사 완료 → 상품 즉시 등록</p>
            <p>③ 구매자가 RP 또는 Toss로 결제하면 Fabric 에스크로에 잠금 → 72시간 후 자동 정산</p>
          </div>
        </div>

        {/* 등록 버튼 */}
        <button
          type="submit"
          disabled={uploading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              업로드 중...
            </>
          ) : (
            '상품 등록'
          )}
        </button>
      </form>

      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="sell"
      />
    </div>
  )
}
