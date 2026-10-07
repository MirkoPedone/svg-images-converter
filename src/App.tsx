import React, { useState, useEffect } from 'react';
import { 
  Layout, Upload, Button, Select, ColorPicker, Space, Typography, 
  Tooltip, message, Modal, Popconfirm, Drawer, Card, List, Empty 
} from 'antd';
import { 
  InboxOutlined, EditOutlined, HeartOutlined, HeartFilled, 
  CodeOutlined, BorderOutlined, FolderOpenOutlined, DeleteOutlined 
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { Moon, Sun, ArrowLeft } from 'lucide-react';
import ImageTracer from 'imagetracerjs';
import './App.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Dragger } = Upload;

const DETAILS_OPTIONS = [
  { value: 'weak', label: 'Weak' },
  { value: 'normal', label: 'Normal' },
  { value: 'strong', label: 'Strong' },
];

const FILTERS_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'edge1', label: 'Edge 1' },
  { value: 'edge2', label: 'Edge 2' },
  { value: 'internal1', label: 'Internal 1' },
  { value: 'smooth1', label: 'Smooth 1' },
  { value: 'clean1', label: 'Clean 1' },
  { value: 'sharp1', label: 'Sharp 1' },
  { value: 'detail1', label: 'Detail 1' },
  { value: 'artistic1', label: 'Artistic 1' },
  { value: 'artistic2', label: 'Artistic 2' },
];

function getTracerOptions(detail: string, filter: string, color: string) {
  let options = { ...ImageTracer.optionpresets.default };
  
  if (filter.startsWith('edge')) options = { ...ImageTracer.optionpresets.edges };
  else if (filter.startsWith('smooth')) options = { ...ImageTracer.optionpresets.smoothed };
  else if (filter.startsWith('sharp')) options = { ...ImageTracer.optionpresets.sharp };
  else if (filter.startsWith('detail')) options = { ...ImageTracer.optionpresets.detailed };
  else if (filter.startsWith('artistic')) options = { ...ImageTracer.optionpresets.posterized1 };
  else if (filter.startsWith('clean')) options = { ...ImageTracer.optionpresets.curvy };

  if (detail === 'strong') {
    options.ltres = 0.5; options.qtres = 0.5; options.pathomit = 4;
  } else if (detail === 'weak') {
    options.ltres = 5; options.qtres = 5; options.pathomit = 16;
  } else {
    options.ltres = 1; options.qtres = 1; options.pathomit = 8;
  }
  return options;
}

interface SavedSVG {
  id: string;
  svg: string;
  date: number;
}

export default function App() {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [detail, setDetail] = useState('strong');
  const [filter, setFilter] = useState('artistic2');
  const [color, setColor] = useState<string>('#000000');
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [transparentBg, setTransparentBg] = useState(true);

  // Favorites state
  const [savedSvgs, setSavedSvgs] = useState<SavedSVG[]>(() => {
    const saved = localStorage.getItem('saved_svgs');
    return saved ? JSON.parse(saved) : [];
  });
  const [favoritesDrawerOpen, setFavoritesDrawerOpen] = useState(false);

  // Sync favorites to local storage
  useEffect(() => {
    localStorage.setItem('saved_svgs', JSON.stringify(savedSvgs));
  }, [savedSvgs]);

  const props: UploadProps = {
    onRemove: (file) => {
      setFileList([]);
      setImageUrl(null);
      setSvgContent(null);
    },
    beforeUpload: (file) => {
      const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
      if (!isJpgOrPng) {
        message.error('Puoi caricare solo file JPG/PNG!');
        return Upload.LIST_IGNORE;
      }
      setFileList([file]);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      return false; 
    },
    fileList,
  };

  const processImage = () => {
    if (!imageUrl) return;
    setIsProcessing(true);
    const options = getTracerOptions(detail, filter, color);
    
    setTimeout(() => {
      ImageTracer.imageToSVG(
        imageUrl,
        (svgstr: string) => {
          let coloredSvg = svgstr.replace(/fill="rgb\([^\)]+\)"/g, `fill="${color}"`);
          setSvgContent(coloredSvg);
          setIsProcessing(false);
        },
        options
      );
    }, 100);
  };

  useEffect(() => {
    if (imageUrl) {
      processImage();
    }
  }, [detail, filter, color]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.body.style.backgroundColor = isDarkMode ? '#ffffff' : '#141414';
    document.body.style.color = isDarkMode ? '#000000' : '#ffffff';
  };

  const downloadSvg = (content: string | null, filename: string = 'converted.svg') => {
    if (!content) return;
    const blob = new Blob([content], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveToFavorites = () => {
    if (!svgContent) return;
    const newSvg: SavedSVG = {
      id: Date.now().toString(),
      svg: svgContent,
      date: Date.now()
    };
    setSavedSvgs([newSvg, ...savedSvgs]);
    message.success('Immagine salvata nei preferiti!');
  };

  const removeFavorite = (id: string) => {
    setSavedSvgs(savedSvgs.filter(s => s.id !== id));
    message.success('Preferito rimosso con successo.');
  };

  return (
    <Layout style={{ minHeight: '100vh', background: isDarkMode ? '#141414' : '#f5f5f5' }}>
      <Header style={{ background: isDarkMode ? '#1f1f1f' : '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid #e8e8e8' }}>
        <Title level={4} style={{ margin: 0, color: '#2c77fb', display: 'flex', alignItems: 'center', gap: '8px' }}>
          PicSVG <Text style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>Clone</Text>
        </Title>
        {imageUrl && (
          <Space size="large" align="center" className="toolbar-controls">
            <Space>
              <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>Details</Text>
              <Select value={detail} onChange={setDetail} options={DETAILS_OPTIONS} style={{ width: 100 }} />
            </Space>
            
            <Space>
              <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>Filters</Text>
              <Select value={filter} onChange={setFilter} options={FILTERS_OPTIONS} style={{ width: 120 }} />
            </Space>
            
            <ColorPicker value={color} onChange={(c, hex) => setColor(hex)} format="hex" />
          </Space>
        )}
        
        <Button 
          type="primary" 
          icon={<FolderOpenOutlined />} 
          onClick={() => setFavoritesDrawerOpen(true)}
          style={{ background: '#2c77fb' }}
        >
          Preferiti ({savedSvgs.length})
        </Button>
      </Header>

      <Content style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {!imageUrl ? (
          <div style={{ width: '100%', maxWidth: '800px', marginTop: '40px' }}>
            <Dragger {...props} style={{ background: isDarkMode ? '#1f1f1f' : '#fff', padding: '40px 0' }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#2c77fb' }} />
              </p>
              <p className="ant-upload-text" style={{ color: isDarkMode ? '#fff' : 'inherit' }}>
                Clicca o trascina un'immagine in quest'area per caricarla
              </p>
              <p className="ant-upload-hint" style={{ color: isDarkMode ? '#888' : 'inherit' }}>
                Supporta JPG, PNG, GIF, WEBP.
              </p>
            </Dragger>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '1200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Button icon={<ArrowLeft />} onClick={() => { setImageUrl(null); setSvgContent(null); setFileList([]); }}>
                Upload another image
              </Button>
              
              <Space size="middle" className="action-buttons">
                <Tooltip title="Edit">
                  <Button type="text" icon={<EditOutlined style={{ fontSize: '20px' }} />} />
                </Tooltip>
                <Tooltip title="Save to Favorites">
                  <Button type="text" onClick={saveToFavorites} icon={<HeartOutlined style={{ fontSize: '20px' }} />} />
                </Tooltip>
                <Tooltip title="Toggle Theme">
                  <Button type="text" onClick={toggleTheme} icon={isDarkMode ? <Sun size={20} /> : <Moon size={20} />} />
                </Tooltip>
                <Tooltip title="View Source">
                  <Button type="text" onClick={() => setShowCode(true)} icon={<CodeOutlined style={{ fontSize: '20px' }} />} />
                </Tooltip>
                <Tooltip title="Toggle Background">
                  <Button type="text" onClick={() => setTransparentBg(!transparentBg)} icon={<BorderOutlined style={{ fontSize: '20px' }} />} />
                </Tooltip>
                <Button type="primary" onClick={() => downloadSvg(svgContent)} style={{ background: '#4caf50' }}>Download SVG</Button>
              </Space>
            </div>
            
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
                <Title level={5} style={{ textAlign: 'center', color: isDarkMode ? '#fff' : '#595959' }}>Original Image</Title>
                <div style={{ 
                  background: isDarkMode ? '#1f1f1f' : '#fff', 
                  padding: '16px', 
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '400px'
                }}>
                  <img src={imageUrl} alt="Original" style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain' }} />
                </div>
              </div>
              
              <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
                <Title level={5} style={{ textAlign: 'center', color: isDarkMode ? '#fff' : '#595959' }}>Vector SVG</Title>
                <div 
                  className={transparentBg ? 'checkerboard-bg' : ''}
                  style={{ 
                    background: transparentBg ? 'transparent' : (isDarkMode ? '#1f1f1f' : '#fff'),
                    padding: '16px', 
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '400px',
                    opacity: isProcessing ? 0.5 : 1
                  }}
                >
                  {isProcessing ? (
                    <Text>Processing...</Text>
                  ) : svgContent ? (
                    <div 
                      dangerouslySetInnerHTML={{ __html: svgContent }} 
                      style={{ maxWidth: '100%', maxHeight: '600px', width: '100%', display: 'flex', justifyContent: 'center' }}
                    />
                  ) : (
                    <Text>Error generating SVG</Text>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Content>
      
      <Modal 
        title="SVG Source Code" 
        open={showCode} 
        onCancel={() => setShowCode(false)}
        footer={null}
        width={800}
      >
        <pre style={{ 
          background: '#f5f5f5', 
          padding: '16px', 
          borderRadius: '4px', 
          maxHeight: '400px', 
          overflow: 'auto',
          fontSize: '12px',
          color: '#000'
        }}>
          {svgContent}
        </pre>
      </Modal>

      {/* Drawer per i Preferiti */}
      <Drawer
        title="I tuoi SVG Preferiti"
        placement="right"
        width={400}
        onClose={() => setFavoritesDrawerOpen(false)}
        open={favoritesDrawerOpen}
        styles={{ body: { paddingBottom: 80, background: isDarkMode ? '#141414' : '#fff' }, header: { background: isDarkMode ? '#1f1f1f' : '#fff' } }}
      >
        {savedSvgs.length === 0 ? (
          <Empty description="Nessun SVG salvato nei preferiti" />
        ) : (
          <List
            grid={{ gutter: 16, column: 1 }}
            dataSource={savedSvgs}
            renderItem={(item) => (
              <List.Item>
                <Card 
                  hoverable
                  style={{ background: isDarkMode ? '#1f1f1f' : '#fff', borderColor: isDarkMode ? '#333' : '#f0f0f0' }}
                  actions={[
                    <Tooltip title="Download">
                      <Button type="text" onClick={() => downloadSvg(item.svg, `favorite-${item.id}.svg`)}>⬇️</Button>
                    </Tooltip>,
                    <Popconfirm
                      title="Elimina preferito"
                      description="Sei sicuro di voler eliminare questo SVG dai preferiti?"
                      onConfirm={() => removeFavorite(item.id)}
                      okText="Ok"
                      cancelText="Annulla"
                      placement="left"
                    >
                      <Tooltip title="Rimuovi">
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  ]}
                >
                  <div 
                    className="checkerboard-bg"
                    style={{ 
                      height: '150px', 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      padding: '10px'
                    }}
                    dangerouslySetInnerHTML={{ __html: item.svg }}
                  />
                  <div style={{ marginTop: '10px', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Salvato il {new Date(item.date).toLocaleDateString()} alle {new Date(item.date).toLocaleTimeString()}
                    </Text>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </Layout>
  );
}
