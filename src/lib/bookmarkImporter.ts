
import { Bookmark, BookmarkType, Tag } from './types';
import { generateUniqueId, getBookmarkTypeFromUrl } from './bookmarkUtils';

/**
 * Parse a Chrome/Firefox bookmark HTML export file
 * @param htmlContent The HTML content from a bookmarks export file
 * @returns Array of parsed bookmarks
 */
export const parseBookmarkHtml = (htmlContent: string): Partial<Bookmark>[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const bookmarks: Partial<Bookmark>[] = [];
  
  try {
    // Find all <a> elements (bookmarks) in the document
    const bookmarkElements = doc.querySelectorAll('a');
    
    if (bookmarkElements.length === 0) {
      console.warn('No bookmark elements found in the HTML');
    }
    
    bookmarkElements.forEach((element) => {
      try {
        const url = element.getAttribute('href');
        if (!url) return;
        
        const title = element.textContent?.trim() || url;
        
        // Handle different date formats - Chrome uses add_date, Firefox might use ADDED
        const addDate = element.getAttribute('add_date') || element.getAttribute('ADDED');
        // Some browsers use UNIX timestamp (seconds), others might use milliseconds
        let dateAdded: Date;
        if (addDate) {
          const timestamp = parseInt(addDate, 10);
          dateAdded = new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000);
        } else {
          dateAdded = new Date();
        }
        
        // Try to extract folder as category
        // Look for parent DL/DT structure which is common in bookmark exports
        let folder: string | undefined;
        let current = element.parentElement;
        
        // Navigate up the DOM to find a folder name
        while (current && !folder) {
          // Look for a DT (definition term) or H3 (header) that might contain folder name
          const folderElement = current.querySelector(':scope > h3, :scope > dt > h3');
          if (folderElement && folderElement.textContent) {
            folder = folderElement.textContent.trim();
            break;
          }
          
          // Check parent's previous sibling for a heading
          const prevSibling = current.previousElementSibling;
          if (prevSibling && (prevSibling.tagName === 'H3' || prevSibling.querySelector('h3'))) {
            folder = (prevSibling.tagName === 'H3' ? prevSibling.textContent : prevSibling.querySelector('h3')?.textContent) || undefined;
            break;
          }
          
          current = current.parentElement;
        }
        
        if (!folder) {
          // Alternative approach - try closest DL's previous sibling
          folder = element.closest('dl')?.previousElementSibling?.textContent?.trim();
        }
        
        let tags: Tag[] = [];
        
        // Check if there are any tags added to the bookmark
        const tagsAttr = element.getAttribute('tags') || element.getAttribute('TAGS');
        if (tagsAttr) {
          const tagNames = tagsAttr.split(',').map(t => t.trim()).filter(Boolean);
          tags = tagNames.map(name => ({
            id: generateUniqueId(),
            name
          }));
        }
        
        bookmarks.push({
          id: generateUniqueId(),
          url,
          title,
          type: getBookmarkTypeFromUrl(url),
          dateAdded,
          tags,
          isAlive: true,
          // If we found a folder, create a placeholder category
          category: folder ? { id: folder, name: folder } : undefined
        });
      } catch (err) {
        console.error('Error parsing individual bookmark:', err);
        // Continue with next bookmark
      }
    });
  } catch (err) {
    console.error('Error parsing bookmarks HTML:', err);
  }
  
  return bookmarks;
};

/**
 * Process multiple bookmarks for import, preserving unique tags and categories
 */
export const processBookmarksForImport = (
  bookmarks: Partial<Bookmark>[],
  existingTags: Tag[],
  existingCategories: { id: string; name: string }[]
): {
  bookmarks: Bookmark[];
  newTags: Tag[];
  newCategories: { id: string; name: string }[];
} => {
  try {
    const newTags: Tag[] = [];
    const newTagMap = new Map<string, Tag>();
    const existingTagMap = new Map<string, Tag>();
    
    // Create maps for existing tags (by name for easy lookup)
    existingTags.forEach(tag => {
      existingTagMap.set(tag.name.toLowerCase(), tag);
    });
    
    // Track categories we need to create
    const newCategories: { id: string; name: string }[] = [];
    const existingCategoryMap = new Map<string, { id: string; name: string }>();
    const newCategoryMap = new Map<string, { id: string; name: string }>();
    
    // Create maps for existing categories
    existingCategories.forEach(category => {
      existingCategoryMap.set(category.name.toLowerCase(), category);
    });
    
    // Process bookmarks to finalize them and collect tags/categories
    const processedBookmarks = bookmarks.map(bookmark => {
      // Process tags - use existing ones or create new ones
      const finalTags: Tag[] = [];
      
      bookmark.tags?.forEach(tag => {
        const tagName = tag.name.toLowerCase();
        
        // Check if we've already seen this tag in this import
        if (newTagMap.has(tagName)) {
          finalTags.push(newTagMap.get(tagName)!);
          return;
        }
        
        // Check if this tag already exists in the system
        if (existingTagMap.has(tagName)) {
          finalTags.push(existingTagMap.get(tagName)!);
          return;
        }
        
        // If not, create a new tag
        const newTag: Tag = {
          id: generateUniqueId(),
          name: tag.name,
          color: tag.color
        };
        
        newTags.push(newTag);
        newTagMap.set(tagName, newTag);
        finalTags.push(newTag);
      });
      
      // Process category - use existing one or create new one
      let finalCategory = bookmark.category;
      
      if (finalCategory) {
        const categoryName = finalCategory.name.toLowerCase();
        
        // Check if we've already seen this category in this import
        if (newCategoryMap.has(categoryName)) {
          finalCategory = newCategoryMap.get(categoryName);
        }
        // Check if this category already exists in the system
        else if (existingCategoryMap.has(categoryName)) {
          finalCategory = existingCategoryMap.get(categoryName);
        }
        // If not, add it to our list of new categories to create
        else {
          const newCategory = {
            id: generateUniqueId(),
            name: finalCategory.name,
            icon: finalCategory.icon
          };
          
          newCategories.push(newCategory);
          newCategoryMap.set(categoryName, newCategory);
          finalCategory = newCategory;
        }
      }
      
      // Create the final bookmark object
      return {
        id: bookmark.id || generateUniqueId(),
        url: bookmark.url!,
        title: bookmark.title || bookmark.url!,
        description: bookmark.description,
        type: bookmark.type || 'link',
        thumbnailUrl: bookmark.thumbnailUrl,
        videoThumbnailTimestamp: bookmark.videoThumbnailTimestamp,
        dateAdded: bookmark.dateAdded || new Date(),
        lastVisited: bookmark.lastVisited,
        lastChecked: bookmark.lastChecked,
        isAlive: bookmark.isAlive !== undefined ? bookmark.isAlive : true,
        contentChanged: bookmark.contentChanged,
        tags: finalTags,
        category: finalCategory,
        favicon: bookmark.favicon
      } as Bookmark;
    });
    
    return {
      bookmarks: processedBookmarks,
      newTags,
      newCategories
    };
  } catch (err) {
    console.error('Error processing bookmarks for import:', err);
    return {
      bookmarks: [],
      newTags: [],
      newCategories: []
    };
  }
};

/**
 * Create a bookmarklet for quickly adding the current page to the bookmark manager
 * @param appUrl The URL of the bookmark manager app
 * @returns A javascript: URL that can be saved as a bookmark
 */
export const generateBookmarklet = (appUrl: string): string => {
  // This bookmarklet grabs the current page's info and redirects to the bookmark app with parameters
  const bookmarkletCode = `
    javascript:(function(){
      var title = document.title;
      var url = window.location.href;
      var description = '';
      
      // Try to get meta description
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) description = metaDesc.getAttribute('content');
      
      // Try to get selected text as description
      var selectedText = window.getSelection().toString();
      if (selectedText) description = selectedText;
      
      // Redirect to our app with the data
      window.open(
        '${appUrl}/add?title=' + encodeURIComponent(title) + 
        '&url=' + encodeURIComponent(url) + 
        '&description=' + encodeURIComponent(description),
        '_blank'
      );
    })();
  `;
  
  // Remove line breaks and extra spaces
  return bookmarkletCode.replace(/\s+/g, ' ').trim();
};
